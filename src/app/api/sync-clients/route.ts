import { NextResponse } from 'next/server';
import { syncVipscaleClients } from '@/app/actions';

export async function POST(request: Request) {
  try {
    // Optional: Add simple authentication so not just anyone can trigger the sync
    const authHeader = request.headers.get('authorization');
    
    // In your n8n HTTP request, you can pass an Authorization header like: "Bearer your_secret_key"
    // To enable this protection, uncomment the following lines and add a SYNC_SECRET to your .env:
    /*
    const expectedSecret = process.env.SYNC_SECRET;
    if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    */

    const result = await syncVipscaleClients();
    
    if (result.success) {
      return NextResponse.json({ 
        message: 'Sync successful', 
        count: result.count 
      });
    } else {
      return NextResponse.json({ 
        error: result.error 
      }, { status: 500 });
    }
  } catch (error: any) {
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
}
