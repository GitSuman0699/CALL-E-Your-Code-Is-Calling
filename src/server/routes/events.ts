import { Router } from 'express';
import { quoteStore } from '../store.js';

export const eventsRouter = Router();

// SSE stream for a specific job
eventsRouter.get('/:id', (req, res) => {
  const jobId = req.params.id;
  const initialJob = quoteStore.getJob(jobId);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send initial state
  if (initialJob) {
    res.write(`data: ${JSON.stringify({ type: 'initial', job: initialJob })}\n\n`);
  }

  const listener = (event: any) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  const eventName = `job:${jobId}`;
  quoteStore.on(eventName, listener);

  req.on('close', () => {
    quoteStore.off(eventName, listener);
    res.end();
  });
});

// SSE global stream for dashboard updates
eventsRouter.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const listener = (event: any) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  quoteStore.on('global', listener);

  req.on('close', () => {
    quoteStore.off('global', listener);
    res.end();
  });
});
