import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createRefundRequest } from '@/app/actions/mcreditRefunds';

export async function POST(req) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { walletId, topupRequestId, requestedMcredits, reason, userNote } = await req.json();

    if (!walletId || !topupRequestId || !requestedMcredits || !reason) {
      return new NextResponse('Missing required fields', { status: 400 });
    }

    const result = await createRefundRequest({
      walletId,
      topupRequestId,
      requestedMcredits,
      reason,
      userNote
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, request: result.request });
  } catch (err) {
    console.error('User Refund Request Route Error:', err);
    return new NextResponse(`Server Error: ${err.message}`, { status: 500 });
  }
}
