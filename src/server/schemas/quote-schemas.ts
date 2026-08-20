import { ServiceCategory } from '../types.js';

export function getRecipientResultSchema(category: ServiceCategory) {
  return {
    type: 'object',
    required: ['quote_provided', 'price_estimate', 'availability', 'evidence'],
    properties: {
      quote_provided: {
        type: 'string',
        enum: ['yes', 'no', 'unknown'],
        description:
          'Whether the service provider provided a concrete or estimated price quote for the job. Use "no" if they declined, were busy, unreachable, or refused without giving any price. Use "unknown" if ambiguous.',
      },
      price_estimate: {
        type: 'string',
        description:
          'The quoted price or price range as stated by the provider (e.g., "₹12,000", "Rs 9500", "5000-7000 rupees", "$250"). If no price was stated, return "not_provided".',
      },
      price_numeric: {
        type: 'number',
        description:
          'The numerical value of the quoted price in standard base units (e.g., 12000 for ₹12,000). Use 0 if not provided or unknown.',
      },
      availability: {
        type: 'string',
        description:
          'When the provider stated they can start or complete the work (e.g., "tomorrow morning", "within 2-3 days", "next Monday", "immediately"). Return "not_discussed" if not mentioned.',
      },
      additional_conditions: {
        type: 'string',
        description:
          'Any extra terms, material charges, travel fees, GST/taxes, or minimum charges mentioned by the vendor. Return "none_mentioned" if standard.',
      },
      provider_notes: {
        type: 'string',
        description:
          'Brief notable context from the conversation (e.g., warranty offered, experience, needs site visit first, materials to be bought by customer).',
      },
      evidence: {
        type: 'string',
        description:
          'A direct verbatim or near-verbatim quote snippet in the spoken language (Hindi, English, etc.) supporting the price and availability.',
      },
    },
    additionalProperties: false,
  };
}

export function getJobOverallResultSchema() {
  return {
    type: 'object',
    required: ['total_providers_called', 'quotes_received'],
    properties: {
      total_providers_called: {
        type: 'integer',
        description: 'Total count of vendors called.',
      },
      quotes_received: {
        type: 'integer',
        description: 'Count of vendors who successfully gave a price quote.',
      },
      best_value_vendor_summary: {
        type: 'string',
        description: 'Short summary of the vendor offering the best deal or lowest quote.',
      },
    },
    additionalProperties: false,
  };
}
