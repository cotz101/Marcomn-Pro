export const LEGAL_EFFECTIVE_DATE = '22 August 2026';

const section = (section_key, title, content, sort_order) => ({
  id: `approved-${section_key}`,
  section_key,
  title,
  content,
  sort_order,
  is_active: true,
});

const page = (slug, title, meta_description, sections, faqs = []) => ({
  page: { id: `approved-${slug}`, slug, title, meta_description, is_published: true },
  sections,
  faqs,
});

const company = `MARCOMN PTE. LTD.\nVISION EXCHANGE, 2 Venture Drive, #13-028, Singapore 608526\nContact: ops@marcomn.com`;

export const APPROVED_CMS_PAGES = {
  'legal/privacy': page(
    'legal/privacy',
    'Privacy Policy',
    'How MarComn collects, uses, shares, stores, and protects personal data.',
    [
      section('introduction', '1. Introduction', `Effective date: ${LEGAL_EFFECTIVE_DATE}\nThis Privacy Policy explains how MARCOMN PTE. LTD. (MarComn, we, us, or our) handles personal data when you use MarComn's websites, applications, services, and related features. It should be read with our [[Terms of Use|/legal/terms]] and, where relevant, our [[MCredits, Payments & Refund Policy|/legal/payments]].`, 1),
      section('who-we-are', '2. Who We Are', `${company}\nMarComn operates a professional maritime community and services platform.`, 2),
      section('data-collected', '3. Personal Data We Collect', `We may collect account and profile information; professional, employment, and Company information; identity and contact information; communications and user content; job postings, applications, resumes, and supporting documents; transaction, wallet, refund, and payment-related records; device, usage, log, and security information; and information you provide when contacting support.\nPayment card details are processed by the applicable payment provider. MarComn does not receive or store complete payment-card numbers through its normal online checkout flow.`, 3),
      section('sources', '4. How We Obtain Personal Data', `We obtain data directly from you, from organizations and users you interact with, automatically through your use of the platform, from service providers such as authentication and payment providers, and from lawful public or third-party sources where appropriate.`, 4),
      section('purposes', '5. How We Use Personal Data', `We use personal data to provide and secure accounts; operate professional profiles, Companies, jobs, applications, communications, wallets, MCredits, payments, refunds, and support; verify activity; prevent fraud and abuse; improve the platform; meet legal obligations; and establish, exercise, or defend legal claims.`, 5),
      section('legal-bases', '6. Legal Bases and Consent', `Depending on the circumstances and applicable law, we process personal data to perform a contract, pursue legitimate interests, comply with legal obligations, protect users and the platform, or with consent. You may withdraw consent where processing relies on consent, without affecting earlier lawful processing.`, 6),
      section('profiles-companies', '7. Profiles, Companies, and Public Content', `Information you choose to publish in a profile, Company page, post, comment, job listing, or other public area may be visible to other users or the public. Review content before publishing and avoid sharing information that should remain private.`, 7),
      section('applications', '8. Job Applications and Private Documents', `Application information and submitted documents are intended for the applicant, the relevant job poster, and authorized Company Owner or Admin users associated with that job. MarComn uses protected access controls for these documents. Recipients must use application data only for legitimate recruitment and related purposes and protect it appropriately.`, 8),
      section('payments', '9. MCredits and Payment Data', `MarComn records wallet balances, MCredit activity, applicable fees, top-ups, refund requests, and related transaction information. Online payments are processed through the applicable payment provider. Please see the [[MCredits, Payments & Refund Policy|/legal/payments]] for payment and refund terms.`, 9),
      section('offline-advances', '10. Offline Advance-Payment Proofs', `Any offline advance payment is arranged directly between the relevant platform parties. MarComn does not receive, hold, escrow, safeguard, or transmit those funds, and Stripe does not process them through MarComn. Supporting proof may be stored through the platform, but the proof or platform record does not itself guarantee payment validity, receipt, recoverability, finality, or legal entitlement.`, 10),
      section('sharing', '11. How We Share Personal Data', `We may share data with users and Companies as needed for requested platform interactions; with service providers that support hosting, authentication, storage, analytics, communications, security, and payments; with professional advisers; in a business transfer; or where required to comply with law or protect rights and safety. We do not sell personal data as a standalone business activity.`, 11),
      section('international', '12. International Transfers', `Our service providers and users may operate in different countries. Where personal data is transferred internationally, we use appropriate safeguards where required by applicable law.`, 12),
      section('retention', '13. Data Retention', `We retain personal data for as long as reasonably necessary for the purposes described in this Policy, including providing services, maintaining transaction and security records, resolving disputes, and meeting legal obligations. Retention periods vary by data type and context.`, 13),
      section('security', '14. Security', `We use reasonable administrative, technical, and organizational measures designed to protect personal data. No system is completely secure, and users are responsible for protecting account credentials and promptly reporting suspected unauthorized access.`, 14),
      section('rights', '15. Your Choices and Rights', `Depending on applicable law, you may request access, correction, deletion, restriction, objection, portability, or withdrawal of consent. Some requests may be limited by legal obligations, other persons' rights, security requirements, or the need to retain transaction and dispute records.`, 15),
      section('children', '16. Children', `MarComn is not intended for children who cannot lawfully consent to the processing of their personal data. If you believe a child has provided personal data improperly, contact us.`, 16),
      section('third-parties', '17. Third-Party Services', `Links or integrations may lead to third-party services governed by their own terms and privacy practices. MarComn is not responsible for those independent practices.`, 17),
      section('changes', '18. Changes to This Policy', `We may update this Policy to reflect legal, operational, or service changes. We will publish the updated version and effective date and provide additional notice where required.`, 18),
      section('contact', '19. Contact Us', `For privacy questions or requests, contact:\n${company}`, 19),
    ]
  ),
  'legal/terms': page(
    'legal/terms',
    'Terms of Use',
    'The terms governing access to and use of MarComn.',
    [
      section('acceptance', '1. Acceptance of These Terms', `Effective date: ${LEGAL_EFFECTIVE_DATE}\nThese Terms of Use form an agreement between you and MARCOMN PTE. LTD. By accessing or using MarComn, you agree to these Terms, our [[Privacy Policy|/legal/privacy]], and any additional terms that apply to a feature, including the [[MCredits, Payments & Refund Policy|/legal/payments]]. If you use MarComn for an organization, you confirm that you have authority to bind it.`, 1),
      section('company', '2. About MarComn', `${company}\nMarComn provides a professional maritime community and services platform.`, 2),
      section('eligibility', '3. Eligibility', `You must have legal capacity to enter these Terms and satisfy any minimum age or other requirements under applicable law. You must provide accurate information and use the platform only for lawful purposes.`, 3),
      section('accounts', '4. Accounts and Security', `You are responsible for maintaining the security of your account and for activity carried out through your account to the extent reasonably within your control. Notify us promptly of suspected unauthorized access. Accounts, identities, or permissions must not be shared or misrepresented.`, 4),
      section('company-authority', '5. Company Accounts and Authority', `Users acting for a Company must be properly authorized. Company roles and permissions determine available platform actions. A Company is responsible for activity performed through its authorized users, subject to applicable law and MarComn's security controls.`, 5),
      section('acceptable-use', '6. Acceptable Use', `You must not violate law or third-party rights; impersonate others; submit deceptive, harmful, discriminatory, or unlawful content; interfere with platform security or operation; scrape or access the service without authorization; distribute malware; or use MarComn to facilitate fraud or abuse.`, 6),
      section('content', '7. User Content', `You retain ownership of content you submit. You grant MarComn a non-exclusive licence to host, process, reproduce, display, and transmit that content as reasonably necessary to operate, secure, and improve the service. You confirm that you have the rights needed to submit it.`, 7),
      section('jobs-applications', '8. Jobs, Applications, and Recruitment', `Job posters and applicants are responsible for the accuracy and lawfulness of their submissions and decisions. MarComn provides platform tools but is not the employer, recruiter, agent, or guarantor of a job or candidate unless expressly stated. Application documents may be accessed only by viewers authorized under MarComn's privacy and access rules.`, 8),
      section('services', '9. User and Company Dealings', `Users and Companies are responsible for evaluating each other and for agreements made through or outside MarComn. MarComn is not a party to those agreements unless expressly stated.`, 9),
      section('mcredits', '10. MCredits and Platform Fees', `MCredits are internal MarComn platform credits used for eligible platform actions. Applicable prices and platform fees are displayed or confirmed through the relevant workflow. Fees confirmed for a completed action are not changed retroactively. Full terms are in the [[MCredits, Payments & Refund Policy|/legal/payments]].`, 10),
      section('online-payments', '11. Online Payments', `Online top-ups may be processed by a third-party payment provider. MCredits are credited after payment is successfully confirmed through the applicable payment process. Provider terms and availability may also apply.`, 11),
      section('offline-payments', '12. Offline Advance Payments', `Offline advance payments are direct arrangements between the relevant platform parties. MarComn does not receive, hold, escrow, safeguard, or transmit those funds, and Stripe does not process them through MarComn. MCredit refund rules do not apply. Stored proof does not guarantee validity, receipt, recoverability, finality, or legal entitlement.`, 12),
      section('refunds', '13. Refunds', `Refund eligibility and processing for MCredit top-ups are governed by the [[MCredits, Payments & Refund Policy|/legal/payments]]. Submitting a request does not guarantee approval.`, 13),
      section('privacy', '14. Privacy', `Our collection and use of personal data are described in the [[Privacy Policy|/legal/privacy]]. Users receiving another person's data must handle it lawfully and only for legitimate purposes.`, 14),
      section('intellectual-property', '15. MarComn Intellectual Property', `MarComn and its licensors retain rights in the platform, branding, software, designs, and content we provide. Except as permitted by law or written authorization, you may not copy, reverse engineer, resell, or exploit them.`, 15),
      section('third-parties', '16. Third-Party Services', `Third-party services and links are governed by their own terms. MarComn does not control and is not responsible for their independent acts, availability, or content.`, 16),
      section('availability', '17. Service Availability and Changes', `We may maintain, update, suspend, or change features. We do not promise uninterrupted or error-free availability. Material changes affecting users will be communicated where reasonably practicable or legally required.`, 17),
      section('suspension', '18. Suspension and Termination', `We may restrict or terminate access where reasonably necessary for security, legal compliance, breach of these Terms, non-payment, fraud, abuse, or protection of users and the platform. You may stop using MarComn at any time. Provisions that should reasonably survive will remain effective.`, 18),
      section('disclaimers', '19. Disclaimers', `To the extent permitted by law, MarComn is provided on an as-available basis. Users remain responsible for professional, hiring, commercial, and payment decisions. MarComn does not guarantee identity, qualifications, opportunities, outcomes, or transactions between users.`, 19),
      section('liability', '20. Liability', `To the extent permitted by applicable law, MarComn is not liable for indirect, incidental, special, consequential, or punitive loss, or for loss arising from independent user dealings, third-party services, or unauthorized use outside our reasonable control. Nothing in these Terms limits or excludes liability where doing so would be prohibited by applicable law.`, 20),
      section('indemnity', '21. Responsibility for Breach', `To the extent permitted by law, you are responsible for reasonably foreseeable loss arising from your unlawful use, material breach of these Terms, or infringement of another person's rights.`, 21),
      section('changes', '22. Changes to These Terms', `We may update these Terms for legal, operational, security, or service reasons. The updated version and effective date will be published, with additional notice where required. Continued use after the effective date constitutes acceptance where permitted by law.`, 22),
      section('law', '23. Governing Law and Courts', `These Terms are governed by the laws of Singapore. The courts of Singapore have non-exclusive jurisdiction, subject to any mandatory rights or remedies that cannot lawfully be restricted.`, 23),
      section('contact', '24. Contact', `Questions about these Terms may be sent to:\n${company}`, 24),
    ]
  ),
  'legal/payments': page(
    'legal/payments',
    'MCredits, Payments & Refund Policy',
    'How MCredits, online top-ups, platform fees, offline advances, and refunds work on MarComn.',
    [
      section('scope', '1. Scope and Effective Date', `Effective date: ${LEGAL_EFFECTIVE_DATE}\nThis Policy applies to MCredits, online top-ups, platform fees, refund requests, and related payment records on MarComn. It forms part of our [[Terms of Use|/legal/terms]] and should be read with our [[Privacy Policy|/legal/privacy]].`, 1),
      section('operator', '2. Platform Operator', company, 2),
      section('what-are-mcredits', '3. What MCredits Are', `MCredits are internal MarComn platform credits. They are not money, electronic money, a bank deposit, a cryptocurrency, or an investment. They may be used only for eligible actions made available through MarComn and cannot be transferred or redeemed for cash except where required by law or expressly approved under this Policy.`, 3),
      section('wallets', '4. Personal and Company Wallets', `MCredits may be held in a Personal wallet or a Company wallet. A user acting through a Company uses the Company's wallet where the workflow identifies the Company as the paying identity. Users must have the required authority for wallet activity.`, 4),
      section('topups', '5. Online Top-Ups', `Available top-up packages and prices are shown through the relevant workflow. MCredits are credited after payment is successfully confirmed through the applicable payment process. Payment-provider records and platform transaction records may be used to verify the outcome.`, 5),
      section('fees', '6. Platform Fees', `Eligible actions may require MCredits. The applicable price or fee is displayed or confirmed before completion. Once an action is completed, its confirmed fee is not changed retroactively. Future pricing may change prospectively, with updated prices shown in the applicable workflow.`, 6),
      section('used-credits', '7. Used MCredits', `MCredit purchases are generally final once the MCredits have been used. Completed platform actions and consumed MCredits are normally not reversible merely because a user later changes their mind. This does not limit rights that cannot lawfully be excluded.`, 7),
      section('eligibility', '8. Refund Eligibility', `Unused MCredits purchased through an eligible online top-up may qualify for a refund after review, including where there is a duplicate, technical, incorrect, or unauthorized transaction. Eligibility is limited to the remaining eligible unused balance and is subject to payment-provider capability, applicable law, and MarComn's transaction records.`, 8),
      section('requests', '9. Refund Requests and Review', `Contact ops@marcomn.com or use an available refund-request workflow with sufficient transaction details. MarComn may request information needed to verify the account, payment, usage, and request. Submitting a refund request does not guarantee approval.`, 9),
      section('processing', '10. Approved Refund Processing', `An approved refund remains approved even if automated payment-provider processing is temporarily unavailable. An approved refund may be processed through the available payment-provider workflow or another appropriate administrative process. Timing and method depend on verification, provider capability, applicable law, and transaction records.`, 10),
      section('adjustments', '11. Wallet Adjustments', `Where a refund is completed, MarComn may deduct or cancel the corresponding eligible unused MCredits and record the adjustment. We may correct duplicate credits, obvious processing errors, fraud, chargebacks, or unauthorized transactions where permitted by law.`, 11),
      section('chargebacks', '12. Chargebacks and Disputes', `Contact MarComn first where practical so we can investigate. A chargeback or payment dispute may result in temporary restrictions or wallet adjustments while the matter is reviewed. Nothing here removes mandatory payment-dispute rights.`, 12),
      section('offline-advances', '13. Offline Advance Payments', `Offline advance payments are arranged directly between the relevant platform parties. MarComn does not receive, hold, escrow, safeguard, or transmit those funds, and Stripe does not process them through MarComn. MCredit refund rules do not apply to those funds. Supporting proof may be stored, but it does not itself guarantee payment validity, receipt, recoverability, finality, or legal entitlement.`, 13),
      section('provider', '14. Payment Provider', `Online payments may be processed by Stripe or another available payment provider. Provider capability, rules, processing times, and records may affect a payment or refund. MarComn does not store complete payment-card numbers through its normal checkout flow.`, 14),
      section('changes', '15. Changes to This Policy', `We may update this Policy for legal, operational, provider, or service changes. Updates apply prospectively from their stated effective date unless applicable law requires otherwise.`, 15),
      section('contact', '16. Contact', `Payment and refund questions may be sent to:\n${company}`, 16),
    ]
  ),
  credits: page(
    'credits',
    'About MCredits',
    'A practical guide to MarComn platform credits, packages, wallets, fees, and refunds.',
    [
      section('about-mcredits', 'What are MCredits?', `MCredits are internal MarComn platform credits used for eligible actions on MarComn. They are not money, cryptocurrency, an investment, or a transferable cash balance.`, 1),
      section('wallets', 'Personal and Company wallets', `MCredits can be held in Personal or Company wallets. The paying wallet is identified by the workflow and your selected authorized identity.`, 2),
      section('available-packages', 'Available packages', `Current active top-up packages appear below. The checkout workflow confirms the package, price, and MCredit amount before payment.`, 3),
      section('using-mcredits', 'Using MCredits', `Certain platform actions require MCredits. Applicable prices and platform fees are displayed or confirmed through the relevant workflow. Future prices may change prospectively; a fee already confirmed for a completed action is not changed retroactively.`, 4),
      section('refunds', 'Refunds', `MCredit purchases are generally final once the MCredits have been used. Unused MCredits from an eligible online top-up may qualify for a refund after review. Submitting a request does not guarantee approval. See the binding MCredits, Payments & Refund Policy below.`, 5),
      section('help', 'Need help?', `For wallet, payment, or refund questions, contact ops@marcomn.com.`, 6),
    ],
    [
      { id: 'approved-faq-1', question: 'Are MCredits money or cryptocurrency?', answer: 'No. MCredits are internal MarComn platform credits for eligible platform actions.' },
      { id: 'approved-faq-2', question: 'Can MCredit pricing change?', answer: 'Future package prices and platform fees may change prospectively. Current amounts are displayed or confirmed in the relevant workflow.' },
      { id: 'approved-faq-3', question: 'Can unused MCredits be refunded?', answer: 'Eligible unused MCredits from an online top-up may qualify after review. Approval depends on the remaining eligible balance, payment-provider capability, applicable law, and transaction records.' },
    ]
  ),
};

export function getApprovedCMSPage(slug) {
  return APPROVED_CMS_PAGES[slug] || null;
}
