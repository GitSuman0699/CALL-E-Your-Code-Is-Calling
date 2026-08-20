import { ServiceCategory, TargetVendor } from '../types.js';
import { getRecipientResultSchema } from '../schemas/quote-schemas.js';
import dotenv from 'dotenv';
dotenv.config();

export interface CalleApiResponse {
  id: string;
  status: 'queued' | 'in_progress' | 'completed' | 'failed' | 'canceled';
  task: string;
  recipients?: Array<{
    id: string;
    phones: string[];
    status: string;
    structured_result?: Record<string, any> | null;
    summary?: string | null;
    attempts?: any[];
  }>;
  structured_result?: Record<string, any> | null;
  summary?: string | null;
  transcript?: string | null;
  failure_code?: string | null;
  failure_message?: string | null;
  created_at: string;
  completed_at?: string | null;
}

export class CalleService {
  private apiKey: string | null = null;
  private baseUrl: string = 'https://api.heycall-e.com';
  private isConfigured: boolean = false;

  constructor() {
    const key = process.env.CALLE_API_KEY;
    if (key && key.startsWith('iams_')) {
      this.apiKey = key;
      this.isConfigured = true;
      console.log('✅ CALL-E Live API Client initialized with key.');
    } else {
      console.log('ℹ️ No live CALLE_API_KEY found.');
    }
  }

  isLive(): boolean {
    return this.isConfigured && this.apiKey !== null;
  }

  /**
   * Helper to execute an HTTP request with automatic retry logic & exponential backoff
   */
  private async fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
    let delay = 1000;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, options);

        // Success or non-retryable client error (e.g. 400, 422)
        if (response.ok || (response.status >= 400 && response.status < 500 && response.status !== 429)) {
          return response;
        }

        // Rate limit (429) or Server error (5xx) -> Retry
        console.warn(`⚠️ [CALL-E] Request returned status ${response.status}. Retrying attempt ${attempt}/${maxRetries} in ${delay}ms...`);
      } catch (networkErr: any) {
        console.warn(`⚠️ [CALL-E] Network error: ${networkErr.message}. Retrying attempt ${attempt}/${maxRetries} in ${delay}ms...`);
        if (attempt === maxRetries) throw networkErr;
      }

      await new Promise((res) => setTimeout(res, delay));
      delay *= 2; // Exponential backoff
    }

    return fetch(url, options);
  }

  /**
   * Launch parallel outbound calls to each vendor via CALL-E REST API with full retry & error handling
   */
  async launchParallelVendorCalls(params: {
    jobId: string;
    category: ServiceCategory;
    description: string;
    vendors: TargetVendor[];
    onVendorUpdate: (vendorId: string, updates: Partial<TargetVendor>) => void;
  }): Promise<void> {
    if (!this.apiKey) {
      throw new Error('CALL-E API key is not configured. Please set CALLE_API_KEY in .env.');
    }

    const { jobId, category, description, vendors, onVendorUpdate } = params;

    const resultSchema = getRecipientResultSchema(category) as any;

    const callPromises = vendors.map(async (vendor) => {
      try {
        // E.164 phone formatting
        let cleanedPhone = vendor.phone.replace(/[\s\(\)\-]/g, '').trim();
        if (!cleanedPhone.startsWith('+')) {
          cleanedPhone = '+' + cleanedPhone;
        }

        const systemPrompt = `You are QuoteHunter AI, an automated phone assistant calling service provider "${vendor.name}" on phone number ${cleanedPhone} on behalf of a customer to request a price quote.
Job Category: ${category.toUpperCase()}
Job Details: "${description}"

Your Objectives:
1. Introduce yourself clearly with disclosure: "Hi, I am QuoteHunter AI calling on behalf of a customer regarding a ${category} job."
2. Explain the job briefly: "${description}"
3. Inquire if they can take this job and when they can start.
4. Request their estimated price quote (labor, materials, or total).
5. Ask if materials and taxes are included or if there are any extra fees.
6. Thank them politely and conclude the call.

Safety & Communication Rules:
- Clearly disclose AI identity.
- Do not commit to contracts or authorize payments on this call; state that you are gathering estimates for human review.
- Be friendly, concise, and professional. Extract structured quote information.`;

        console.log(`📞 [CALL-E Live] Dispatching call to ${vendor.name} (${cleanedPhone})...`);
        onVendorUpdate(vendor.id, { status: 'dialing' });

        // Build compliant payload
        const payload = {
          task: systemPrompt,
          recipients: [
            {
              phones: [cleanedPhone],
            },
          ],
          result_schema: resultSchema,
          metadata: {
            quotehunter_job_id: jobId,
            category,
            vendor_id: vendor.id,
            vendor_name: vendor.name,
          },
        };

        const idempotencyKey = `qh_${jobId}_${vendor.id}`;

        const createRes = await this.fetchWithRetry(`${this.baseUrl}/v1/calls`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKey,
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(payload),
        });

        const createData = (await createRes.json()) as any;

        if (!createRes.ok || !createData?.id) {
          const errMsg = createData?.error?.message || `API error ${createRes.status}`;
          const errDetails = createData?.error?.details?.validation_errors
            ? JSON.stringify(createData.error.details.validation_errors)
            : JSON.stringify(createData?.error?.details || createData);

          console.error(`❌ [CALL-E Live] Call creation failed for ${vendor.name}:`, errMsg, errDetails);
          onVendorUpdate(vendor.id, {
            status: 'failed',
            providerNotes: `Call failed: ${errMsg}`,
            transcriptSummary: `Validation/API error: ${errMsg}`,
          });
          return;
        }

        const callId = createData.id;
        console.log(`📡 [CALL-E Live] Call placed successfully! Call ID: ${callId} for ${vendor.name}`);

        onVendorUpdate(vendor.id, {
          callId,
          status: 'initializing',
          transcriptSummary: '🤖 Initializing AI voice agent...',
        });

        // Poll for results and live events with 1.5s interval and 5 minute timeout
        const completedCall = await this.pollCallResult(callId, vendor, onVendorUpdate, 1500, 300000);

        console.log(`✅ [CALL-E Live] Call ${callId} completed. Status: ${completedCall.status}`);

        this.processCallResult(vendor, completedCall, onVendorUpdate);
      } catch (err: any) {
        console.error(`❌ [CALL-E Live] Unhandled error for ${vendor.name} (${vendor.phone}):`, err);
        onVendorUpdate(vendor.id, {
          status: 'error',
          providerNotes: `Error: ${err.message || 'Call failed'}`,
          transcriptSummary: `Error encountered: ${err.message || 'Call failed'}`,
        });
      }
    });

    await Promise.allSettled(callPromises);
  }

  /**
   * Polls CALL-E API and developer events stream until call finishes or times out
   */
  private async pollCallResult(
    callId: string,
    vendor: TargetVendor,
    onVendorUpdate: (vendorId: string, updates: Partial<TargetVendor>) => void,
    intervalMs: number,
    timeoutMs: number
  ): Promise<CalleApiResponse> {
    const startTime = Date.now();
    let lastEventId = '';

    while (Date.now() - startTime < timeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));

      try {
        // 1. Check live Developer Events stream for granular status
        const eventsRes = await this.fetchWithRetry(`${this.baseUrl}/v1/calls/${callId}/events`, {
          headers: { Authorization: `Bearer ${this.apiKey}` },
        });

        if (eventsRes.ok) {
          const eventList = (await eventsRes.json()) as { data?: Array<{ id: string; type: string; message: string; status?: string }> };
          const events = eventList?.data || [];
          if (events.length > 0) {
            const latest = events[events.length - 1];
            if (latest.id !== lastEventId) {
              lastEventId = latest.id;
              const msg = latest.message.toLowerCase();

              if (msg.includes('status=calling') || msg.includes('ringing')) {
                onVendorUpdate(vendor.id, {
                  status: 'ringing',
                  transcriptSummary: '🔔 Phone ringing... Waiting for answer',
                });
              } else if (msg.includes('status=in_call') || msg.includes('answered') || msg.includes('talking')) {
                onVendorUpdate(vendor.id, {
                  status: 'in-call',
                  transcriptSummary: '🎙️ Connected! AI agent speaking with provider...',
                });
              } else if (msg.includes('call ended') || msg.includes('syncing')) {
                onVendorUpdate(vendor.id, {
                  status: 'analyzing',
                  transcriptSummary: '📊 Call ended. AI extracting quote & transcript...',
                });
              } else if (msg.includes('create task') || msg.includes('status=pending')) {
                onVendorUpdate(vendor.id, {
                  status: 'dialing',
                  transcriptSummary: '📞 Connecting telecom carrier & dialing...',
                });
              } else if (msg.includes('create bot') || msg.includes('started') || msg.includes('robot')) {
                onVendorUpdate(vendor.id, {
                  status: 'initializing',
                  transcriptSummary: '🤖 Provisioning Voice AI Agent...',
                });
              }
            }
          }
        }

        // 2. Check main Call status
        const res = await this.fetchWithRetry(`${this.baseUrl}/v1/calls/${callId}`, {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
        });

        if (res.ok) {
          const call = (await res.json()) as CalleApiResponse;
          if (['completed', 'failed', 'canceled'].includes(call.status)) {
            return call;
          }
        }
      } catch (pollErr) {
        console.warn(`[CALL-E Live] Warning: Polling transient error for call ${callId}, continuing poll...`, pollErr);
      }
    }

    throw new Error(`CALL-E call ${callId} timed out after ${timeoutMs / 1000}s`);
  }

  /**
   * Gracefully parses call result, supporting structuredResult + fallback extraction
   */
  private processCallResult(
    vendor: TargetVendor,
    call: CalleApiResponse,
    onVendorUpdate: (vendorId: string, updates: Partial<TargetVendor>) => void
  ) {
    // 1. Check top-level or recipient-level structured result
    const structured = call.structured_result || call.recipients?.[0]?.structured_result;
    const summary = call.summary || call.recipients?.[0]?.summary || call.transcript;
    const confidenceLabel = ((call as any).completion_confidence?.label as 'high' | 'medium' | 'low') || 'high';
    const confidenceScore = (call as any).completion_confidence?.score || 0.95;

    if (structured && (structured.quote_provided === 'yes' || structured.price_estimate || structured.price_numeric)) {
      onVendorUpdate(vendor.id, {
        status: 'quoted',
        priceEstimate: structured.price_estimate || (structured.price_numeric ? `$${structured.price_numeric}` : 'Quoted'),
        priceNumeric: structured.price_numeric || this.extractNumber(structured.price_estimate),
        availability: structured.availability || 'Available',
        additionalConditions: structured.additional_conditions,
        providerNotes: structured.provider_notes || summary || 'Quote received from vendor.',
        evidenceSnippet: structured.evidence || (summary ? `"${summary}"` : undefined),
        transcriptSummary: summary || 'Quote successfully received.',
        confidence: confidenceLabel,
        confidenceScore,
      });
      return;
    }

    // 2. Graceful Degradation: If structured data is empty but summary has price info
    if (summary) {
      const fallbackPrice = this.extractPriceFromText(summary);
      if (fallbackPrice) {
        onVendorUpdate(vendor.id, {
          status: 'quoted',
          priceEstimate: fallbackPrice,
          priceNumeric: this.extractNumber(fallbackPrice),
          availability: 'As discussed on call',
          providerNotes: summary,
          evidenceSnippet: `"${summary}"`,
          transcriptSummary: summary,
          confidence: 'medium',
          confidenceScore: 0.75,
        });
        return;
      }
    }

    // 3. Handled Failure / Declined states
    if (call.status === 'failed' || call.failure_code) {
      const failReason = call.failure_message || call.failure_code || 'Call unreachable or unanswered';
      onVendorUpdate(vendor.id, {
        status: 'no-answer',
        providerNotes: failReason,
        transcriptSummary: summary || `Call could not be completed: ${failReason}`,
        confidence: 'low',
        confidenceScore: 0.3,
      });
    } else {
      onVendorUpdate(vendor.id, {
        status: 'refused',
        providerNotes: structured?.provider_notes || summary || 'No price quote provided.',
        evidenceSnippet: structured?.evidence,
        transcriptSummary: summary || 'Provider did not offer a quote.',
        confidence: 'medium',
        confidenceScore: 0.6,
      });
    }
  }

  private extractNumber(str: string | undefined): number | undefined {
    if (!str) return undefined;
    const num = parseInt(str.replace(/[^\d]/g, ''), 10);
    return isNaN(num) ? undefined : num;
  }

  private extractPriceFromText(text: string): string | null {
    const match = text.match(/(?:₹|\$|Rs\.?|USD)?\s*([0-9]+(?:,[0-9]{3})*(?:\.[0-9]{2})?)\s*(?:dollars|rupees|bucks)?/i);
    return match ? match[0].trim() : null;
  }
}

export const calleService = new CalleService();
