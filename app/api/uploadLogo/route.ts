import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { createClient as createServerClient } from '@/utils/supabase/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  console.log('📤 Logo upload API called...');

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const userId = formData.get('userId') as string;
    const cleanupKeepPath = formData.get('cleanupKeepPath') as string | null;

    if (!userId || (!file && !cleanupKeepPath)) {
      return NextResponse.json({ error: 'Missing required fields: file and userId' }, { status: 400 });
    }

    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('❌ User not authenticated:', userError);
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    if (user.id !== userId) {
      console.log('🚫 Permission denied for logo upload:', {
        caller: user.id.slice(0, 8) + '...',
        required: userId.slice(0, 8) + '...'
      });
      return NextResponse.json({
        error: 'Permission denied: only profile owner can upload logo'
      }, { status: 403 });
    }

    if (cleanupKeepPath && !file) {
      if (!cleanupKeepPath.startsWith(`${userId}/logo.`)) {
        return NextResponse.json({ error: 'Invalid cleanup path' }, { status: 400 });
      }
      try {
        const { data: oldFiles } = await supabaseAdmin.storage
          .from('artis-talks-assets')
          .list(userId, { search: 'logo' });

        const toRemove = (oldFiles || [])
          .filter((f) => f.name.startsWith('logo.') && `${userId}/${f.name}` !== cleanupKeepPath)
          .map((f) => `${userId}/${f.name}`);

        if (toRemove.length > 0) {
          await supabaseAdmin.storage.from('artis-talks-assets').remove(toRemove);
        }
      } catch (cleanupError) {
        console.warn('Logo cleanup after successful replace failed:', cleanupError);
      }

      return NextResponse.json({ success: true, cleaned: true });
    }

    if (!file) {
      return NextResponse.json({ error: 'Missing required fields: file and userId' }, { status: 400 });
    }

    console.log('📋 Logo upload details:', { userId, fileSize: file.size, fileType: file.type });

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({
        error: 'Invalid file type. Please upload an image file (JPG, PNG, SVG, or WebP)'
      }, { status: 400 });
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({
        error: 'File size must be less than 5MB'
      }, { status: 400 });
    }

    const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'png';
    const uniqueId = uuidv4();
    const fileName = `${userId}/logo.${uniqueId}.${fileExtension}`;

    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('artis-talks-assets')
      .upload(fileName, file, {
        contentType: file.type,
        cacheControl: '0'
      });

    if (uploadError) {
      console.error('❌ File upload failed:', uploadError);
      return NextResponse.json({ error: 'File upload failed: ' + uploadError.message }, { status: 500 });
    }

    console.log('✅ Logo uploaded:', uploadData.path);

    const { data: urlData } = supabaseAdmin.storage
      .from('artis-talks-assets')
      .getPublicUrl(uploadData.path);

    const cacheBustUrl = `${urlData.publicUrl}?t=${Date.now()}`;
    console.log('📄 Public URL (cache-busted):', cacheBustUrl);

    return NextResponse.json({
      success: true,
      logoUrl: cacheBustUrl,
      logoPath: uploadData.path,
      message: 'Logo uploaded successfully'
    });

  } catch (error: any) {
    console.error('❌ Logo upload error:', error);
    return NextResponse.json({
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
}
