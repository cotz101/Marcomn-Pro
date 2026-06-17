import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { rejectRefundRequest } from '@/app/actions/mcreditRefunds';
import { userHasAdminPermission } from '@/lib/adminPermissions';

export async function POST(req, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Double check admin permission
    const hasPermission = await userHasAdminPermission(user.id, 'can_manage_refund_reviews');
    if (!hasPermission) {
      return new NextResponse('Forbidden: Missing refund management permission', { status: 403 });
    }

    const { id } = await params;
    const { adminNote } = await req.json();

    if (!id) {
      return new NextResponse('Missing required parameters', { status: 400 });
    }

    const result = await rejectRefundRequest(id, adminNote);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Admin Refund Reject Route Error:', err);
    return new NextResponse(`Server Error: ${err.message}`, { status: 500 });
  }
}
