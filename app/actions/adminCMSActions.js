'use server';

import { createClient } from '@/lib/supabase-server';
import { userHasAdminPermission } from '@/lib/adminPermissions';

// Helper to enforce permissions
async function verifyPermission(permissionKey) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Unauthenticated');
  }

  const hasPermission = await userHasAdminPermission(user.id, permissionKey);
  if (!hasPermission) {
    throw new Error('Unauthorized');
  }

  return { supabase, user };
}

/**
 * Fetch all pages, sections, FAQs, and public variables for management.
 */
export async function getCMSManagementData() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Unauthenticated' };
    }

    const canPages = await userHasAdminPermission(user.id, 'can_manage_content_pages');
    const canFaqs = await userHasAdminPermission(user.id, 'can_manage_faqs');

    if (!canPages && !canFaqs) {
      return { success: false, error: 'Unauthorized: Missing required content permissions' };
    }

    // Fetch pages
    const { data: pages, error: pagesError } = await supabase
      .from('cms_pages')
      .select('*')
      .order('slug');
    if (pagesError) throw pagesError;

    // Fetch sections
    const { data: sections, error: sectionsError } = await supabase
      .from('cms_page_sections')
      .select('*')
      .order('sort_order');
    if (sectionsError) throw sectionsError;

    // Fetch FAQs
    const { data: faqs, error: faqsError } = await supabase
      .from('cms_faqs')
      .select('*')
      .order('sort_order');
    if (faqsError) throw faqsError;

    // Fetch content variables (only public ones)
    const { data: variables, error: variablesError } = await supabase
      .from('cms_content_variables')
      .select('*')
      .eq('is_public', true)
      .order('variable_key');
    if (variablesError) throw variablesError;

    return {
      success: true,
      pages: pages || [],
      sections: sections || [],
      faqs: faqs || [],
      variables: variables || [],
      canPages,
      canFaqs
    };
  } catch (error) {
    console.error('Error fetching CMS management data:', error);
    return { success: false, error: error.message || 'Failed to fetch CMS configuration.' };
  }
}

/**
 * Insert or update a page.
 */
export async function saveCMSPage(pageData) {
  try {
    const { supabase } = await verifyPermission('can_manage_content_pages');

    const payload = {
      slug: pageData.slug.trim().toLowerCase(),
      title: pageData.title.trim(),
      meta_description: pageData.meta_description?.trim() || null,
      is_published: !!pageData.is_published,
      updated_at: new Date().toISOString()
    };

    let response;
    if (pageData.id) {
      response = await supabase
        .from('cms_pages')
        .update(payload)
        .eq('id', pageData.id)
        .select()
        .single();
    } else {
      response = await supabase
        .from('cms_pages')
        .insert({
          ...payload,
          created_at: new Date().toISOString()
        })
        .select()
        .single();
    }

    if (response.error) throw response.error;
    return { success: true, page: response.data };
  } catch (error) {
    console.error('Error saving CMS page:', error);
    return { success: false, error: error.message || 'Failed to save page.' };
  }
}

/**
 * Publish or unpublish a page.
 */
export async function publishCMSPage(id, isPublished) {
  try {
    const { supabase } = await verifyPermission('can_manage_content_pages');

    const { data, error } = await supabase
      .from('cms_pages')
      .update({
        is_published: !!isPublished,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return { success: true, page: data };
  } catch (error) {
    console.error('Error toggling page publish status:', error);
    return { success: false, error: error.message || 'Failed to update page status.' };
  }
}

/**
 * Insert or update a section.
 */
export async function saveCMSSection(sectionData) {
  try {
    const { supabase } = await verifyPermission('can_manage_content_pages');

    const payload = {
      page_id: sectionData.page_id,
      section_key: sectionData.section_key.trim().toLowerCase(),
      title: sectionData.title.trim(),
      content: sectionData.content.trim(),
      sort_order: parseInt(sectionData.sort_order) || 0,
      is_active: !!sectionData.is_active,
      updated_at: new Date().toISOString()
    };

    let response;
    if (sectionData.id) {
      response = await supabase
        .from('cms_page_sections')
        .update(payload)
        .eq('id', sectionData.id)
        .select()
        .single();
    } else {
      response = await supabase
        .from('cms_page_sections')
        .insert({
          ...payload,
          created_at: new Date().toISOString()
        })
        .select()
        .single();
    }

    if (response.error) throw response.error;
    return { success: true, section: response.data };
  } catch (error) {
    console.error('Error saving CMS section:', error);
    return { success: false, error: error.message || 'Failed to save section.' };
  }
}

/**
 * Delete a section.
 * TODO: Currently performs a hard delete. For legal/payment auditing, future iterations
 * should prefer soft deactivation (active/inactive toggle) to retain historical compliance data.
 */
export async function deleteCMSSection(id) {
  try {
    const { supabase } = await verifyPermission('can_manage_content_pages');

    const { error } = await supabase
      .from('cms_page_sections')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error deleting CMS section:', error);
    return { success: false, error: error.message || 'Failed to delete section.' };
  }
}

/**
 * Insert or update an FAQ.
 */
export async function saveCMSFAQ(faqData) {
  try {
    const { supabase } = await verifyPermission('can_manage_faqs');

    const payload = {
      page_id: faqData.page_id || null, // Null is allowed for global FAQs
      question: faqData.question.trim(),
      answer: faqData.answer.trim(),
      sort_order: parseInt(faqData.sort_order) || 0,
      is_published: !!faqData.is_published,
      updated_at: new Date().toISOString()
    };

    let response;
    if (faqData.id) {
      response = await supabase
        .from('cms_faqs')
        .update(payload)
        .eq('id', faqData.id)
        .select()
        .single();
    } else {
      response = await supabase
        .from('cms_faqs')
        .insert({
          ...payload,
          created_at: new Date().toISOString()
        })
        .select()
        .single();
    }

    if (response.error) throw response.error;
    return { success: true, faq: response.data };
  } catch (error) {
    console.error('Error saving CMS FAQ:', error);
    return { success: false, error: error.message || 'Failed to save FAQ.' };
  }
}

/**
 * Delete an FAQ.
 * TODO: Currently performs a hard delete. For legal/payment auditing, future iterations
 * should prefer soft deactivation (active/inactive toggle) to retain historical compliance data.
 */
export async function deleteCMSFAQ(id) {
  try {
    const { supabase } = await verifyPermission('can_manage_faqs');

    const { error } = await supabase
      .from('cms_faqs')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error deleting CMS FAQ:', error);
    return { success: false, error: error.message || 'Failed to delete FAQ.' };
  }
}

/**
 * Update a public content variable value.
 */
export async function saveCMSVariable(id, value) {
  try {
    const { supabase } = await verifyPermission('can_manage_content_pages');

    // First ensure the variable is public
    const { data: variable, error: getError } = await supabase
      .from('cms_content_variables')
      .select('variable_key, is_public')
      .eq('id', id)
      .single();
    
    if (getError || !variable) {
      throw new Error('Variable not found');
    }

    if (!variable.is_public) {
      throw new Error('Unauthorized to modify internal variable.');
    }

    const { data, error } = await supabase
      .from('cms_content_variables')
      .update({
        value: value.trim(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return { success: true, variable: data };
  } catch (error) {
    console.error('Error saving content variable:', error);
    return { success: false, error: error.message || 'Failed to update variable.' };
  }
}
