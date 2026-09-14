import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { getCurrentUserAdminRoles } from '@/lib/adminPermissions';
import fs from 'fs';
import path from 'path';

export async function GET(req) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Role Verification: Super Admin only
    const roles = await getCurrentUserAdminRoles(user.id);
    if (!roles.includes('super_admin')) {
      return NextResponse.json({ error: 'Forbidden: Super Admin access required' }, { status: 403 });
    }

    const filePath = path.join(process.cwd(), 'docs', 'handover', 'MarComn_Launch_Operations_Handover_Pack.pdf');

    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: 'Document asset is pending placement. Please place MarComn_Launch_Operations_Handover_Pack.pdf in docs/handover/.' },
        { status: 404 }
      );
    }

    const fileBuffer = await fs.promises.readFile(filePath);
    const { searchParams } = new URL(req.url);
    const dispositionType = searchParams.get('disposition') === 'attachment' ? 'attachment' : 'inline';

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${dispositionType}; filename="MarComn_Launch_Operations_Handover_Pack.pdf"`,
        'Cache-Control': 'private, no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
  } catch (err) {
    console.error('Handover document delivery error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
