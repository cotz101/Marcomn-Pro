import { createClient } from '@/lib/supabase-server';
import { getApprovedCMSPage, LEGAL_EFFECTIVE_DATE } from '@/lib/legalContent';

function formatText(text, variables) {
  if (!text) return '';
  return text.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const value = variables[key.trim()];
    return value === undefined ? match : String(value);
  });
}

function isApprovedRevision(data, approved) {
  if (!data || !approved || data.page.title !== approved.page.title) return false;
  const currentKeys = new Set(data.sections.map((item) => item.section_key));
  return approved.sections.every((item) => currentKeys.has(item.section_key));
}

export async function getCMSPageData(slug) {
  const approved = getApprovedCMSPage(slug);
  let variables = {};
  let cmsData = null;

  try {
    const supabase = await createClient();
    const { data: cmsVariables } = await supabase
      .from('cms_content_variables')
      .select('variable_key, value')
      .eq('is_public', true);
    cmsVariables?.forEach(({ variable_key, value }) => { variables[variable_key] = value; });

    const { data: settings } = await supabase.from('platform_settings').select('key, value');
    settings?.forEach(({ key, value }) => { variables[key] = value; });

    const { data: cmsPage } = await supabase
      .from('cms_pages')
      .select('*')
      .eq('slug', slug)
      .eq('is_published', true)
      .maybeSingle();

    if (cmsPage) {
      const [{ data: sections }, { data: faqs }] = await Promise.all([
        supabase.from('cms_page_sections').select('*').eq('page_id', cmsPage.id).eq('is_active', true).order('sort_order'),
        supabase.from('cms_faqs').select('*').eq('page_id', cmsPage.id).eq('is_published', true).order('sort_order'),
      ]);
      cmsData = { page: cmsPage, sections: sections || [], faqs: faqs || [] };
    }
  } catch (error) {
    console.error(`Error fetching CMS page data for slug: ${slug}`, error);
  }

  const source = isApprovedRevision(cmsData, approved) ? cmsData : approved;
  if (!source) return null;

  variables = { ...variables, legal_effective_date: LEGAL_EFFECTIVE_DATE };
  return {
    page: source.page,
    sections: source.sections.map((item) => ({
      ...item,
      title: formatText(item.title, variables),
      content: formatText(item.content, variables),
    })),
    faqs: source.faqs.map((item) => ({
      ...item,
      question: formatText(item.question, variables),
      answer: formatText(item.answer, variables),
    })),
    variables,
    contentSource: source === cmsData ? 'cms' : 'approved-fallback',
  };
}
