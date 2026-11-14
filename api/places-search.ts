import { searchPlacesTextProxy } from '../src/api-handler.ts';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, status: 405, errorMessage: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const result = await searchPlacesTextProxy(body);
    return res.status(result.status).json(result);
  } catch (error) {
    console.error('Error in /api/places-search:', error);
    return res.status(500).json({
      ok: false,
      status: 500,
      errorCode: 'INTERNAL_ERROR',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }
}
