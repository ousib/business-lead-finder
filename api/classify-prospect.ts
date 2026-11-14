import { classifyProspectOpportunity } from '../src/api-handler.ts';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const result = await classifyProspectOpportunity(body);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error in /api/classify-prospect:', error);
    return res.status(500).json({
      error: 'Failed to classify prospect opportunity',
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
