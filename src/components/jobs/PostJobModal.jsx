import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { useProfile } from '@/app/context/ProfileContext';
import BaseModal from '../layout/BaseModal';
import RichTextEditor from '../common/RichTextEditor';
import { Briefcase, AlertTriangle, Coins } from 'lucide-react';
import { getJobPostingFeePreview, getCompanyWalletBalance, deductJobPostingFee, getUserWalletBalance, deductUserJobPostingFee } from '@/app/actions/mcreditsJobs';

export default function PostJobModal({ isOpen, onClose, onComplete, jobToEdit }) {
  const { currentIdentity, userId, profile } = useProfile();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    location: '',
    startDate: '',
    payAmount: '',
    currency: 'USD',
    payRate: 'Hour',
    jobType: 'Full-time',
    experienceLevel: 'Junior',
    positionStatus: 'Active Position',
    postingStatus: 'Draft',
    description: '',
    responsibilities: ''
  });

  const [skills, setSkills] = useState([]);
  const [skillInput, setSkillInput] = useState('');
  const [withdrawalLimit, setWithdrawalLimit] = useState(3);
  const [tagsString, setTagsString] = useState('');

  // MCredit state
  const [feePreview, setFeePreview] = useState(null); // { feePercent, fee }
  const [walletBalance, setWalletBalance] = useState(null);
  const [mcreditError, setMcreditError] = useState('');

  const isCompany = currentIdentity?.type === 'company' || currentIdentity?.role === 'company';
  const identityName = isCompany ? currentIdentity?.data?.name : (profile?.fullName || 'Anonymous');

  useEffect(() => {
    if (isOpen) {
      if (jobToEdit) {
        let payAmount = '';
        let currency = 'USD';
        let payRate = 'Hour';
        if (jobToEdit.salary_range) {
          const parts = jobToEdit.salary_range.split(' ');
          if (parts.length >= 2) {
            currency = parts[0];
            const rateParts = parts[1].split('/');
            payAmount = rateParts[0] || '';
            payRate = rateParts[1] || 'Hour';
          } else {
            const rateParts = jobToEdit.salary_range.split('/');
            payAmount = rateParts[0] || '';
            payRate = rateParts[1] || 'Hour';
          }
        }

        let startDateStr = '';
        if (jobToEdit.created_at) {
          startDateStr = new Date(jobToEdit.created_at).toISOString().split('T')[0];
        } else {
          startDateStr = new Date().toISOString().split('T')[0];
        }

        setFormData({
          title: jobToEdit.title || '',
          location: jobToEdit.location || '',
          startDate: startDateStr,
          payAmount: payAmount,
          currency: currency,
          payRate: payRate,
          jobType: jobToEdit.employment_type || 'Full-time',
          experienceLevel: jobToEdit.experience_level || 'Junior',
          positionStatus: 'Active Position',
          postingStatus: jobToEdit.status || 'Draft',
          description: jobToEdit.description || '',
          responsibilities: jobToEdit.responsibilities || jobToEdit.description || ''
        });

        if (Array.isArray(jobToEdit.required_skills)) {
          setSkills(jobToEdit.required_skills);
        } else {
          setSkills([]);
        }
        setWithdrawalLimit(jobToEdit.withdrawal_limit ?? 3);
        setTagsString(jobToEdit.tags ? jobToEdit.tags.join(', ') : '');
      } else {
        setFormData({
          title: '',
          location: '',
          startDate: new Date().toISOString().split('T')[0],
          payAmount: '',
          currency: 'USD',
          payRate: 'Hour',
          jobType: 'Full-time',
          experienceLevel: 'Junior',
          positionStatus: 'Active Position',
          postingStatus: 'Draft',
          description: '',
          responsibilities: ''
        });
        setSkills([]);
        setWithdrawalLimit(3);
        setTagsString('');
      }
    }
  }, [jobToEdit, isOpen]);

  // Live MCredit fee preview for job postings
  useEffect(() => {
    if (!isOpen) {
      setFeePreview(null);
      setWalletBalance(null);
      setMcreditError('');
      return;
    }

    const payAmount = parseFloat(formData.payAmount);
    const isNewPublish = !jobToEdit && formData.postingStatus !== 'Draft';
    const isEditPublish = jobToEdit && (jobToEdit.status === 'Draft' || !jobToEdit.status) && (formData.postingStatus === 'Published' || formData.postingStatus === 'Open');

    if (!payAmount || payAmount <= 0 || (!isNewPublish && !isEditPublish)) {
      setFeePreview(null);
      setWalletBalance(null);
      setMcreditError('');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const [preview, wallet] = await Promise.all([
          getJobPostingFeePreview(payAmount),
          isCompany ? getCompanyWalletBalance(currentIdentity.id) : getUserWalletBalance(userId)
        ]);
        if (cancelled) return;
        setFeePreview(preview);
        setWalletBalance(wallet.balance);
        setMcreditError(wallet.balance < preview.fee ? `Insufficient MCredits. Required: ${preview.fee.toFixed(2)} MC, Available: ${wallet.balance.toFixed(2)} MC.` : '');
      } catch (err) {
        if (!cancelled) {
          console.error('MCredit preview error:', err);
          setMcreditError('Unable to check MCredit balance.');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen, formData.payAmount, isCompany, currentIdentity?.id, userId, jobToEdit, formData.postingStatus]);

  if (!isOpen) return null;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddSkill = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = skillInput.trim();
      if (trimmed && skills.length < 5 && !skills.includes(trimmed)) {
        setSkills([...skills, trimmed]);
        setSkillInput('');
      }
    }
  };

  const handleRemoveSkill = (skillToRemove) => {
    setSkills(skills.filter(s => s !== skillToRemove));
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    if (!formData.title || !formData.location || !formData.startDate || !formData.payAmount || !formData.description || !formData.responsibilities) {
      alert('Please fill in all required fields.');
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const salaryNumericVal = parseFloat(formData.payAmount) || null;
    const isPublishingNewJob = !jobToEdit && (formData.postingStatus || '').toLowerCase() !== 'draft';
    const isTransitionToPublish = jobToEdit && ((jobToEdit.status || 'draft').toLowerCase() === 'draft') && ['published', 'open'].includes((formData.postingStatus || '').toLowerCase());

    // Perform wallet balance check prior to any DB operation if publishing
    if ((isPublishingNewJob || isTransitionToPublish) && salaryNumericVal && salaryNumericVal > 0) {
      try {
        const preview = await getJobPostingFeePreview(salaryNumericVal);
        const wallet = await (isCompany ? getCompanyWalletBalance(currentIdentity.id) : getUserWalletBalance(userId));
        if (wallet.balance < preview.fee) {
          alert(`Insufficient MCredits to publish this job. Required: ${preview.fee.toFixed(2)} MC, Available: ${wallet.balance.toFixed(2)} MC. You can keep it as draft or top up your wallet.`);
          setLoading(false);
          return;
        }
      } catch (err) {
        console.error('Wallet validation error:', err);
        alert('Failed to validate MCredits balance: ' + err.message);
        setLoading(false);
        return;
      }
    }

    // Auto-commit any lingering skill input if the user forgot to press Enter
    let finalSkills = [...skills];
    const lingeringSkill = skillInput.trim();
    if (lingeringSkill && finalSkills.length < 5 && !finalSkills.includes(lingeringSkill)) {
      finalSkills.push(lingeringSkill);
      setSkills(finalSkills);
      setSkillInput('');
    }

    const formattedTags = tagsString.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);

    const payload = {
      title: formData.title,
      location: formData.location,
      startDate: formData.startDate,
      payAmount: formData.payAmount,
      currency: formData.currency,
      payRate: formData.payRate,
      jobType: formData.jobType,
      experienceLevel: formData.experienceLevel,
      positionStatus: formData.positionStatus,
      postingStatus: formData.postingStatus,
      skills: finalSkills,
      description: formData.description,
      responsibilities: formData.responsibilities,
      tags: formattedTags
    };
    console.log('Enterprise Job Posting Payload:', payload);

    if (jobToEdit) {
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .update({
          title: formData.title,
          description: formData.description,
          responsibilities: formData.responsibilities,
          location: formData.location,
          salary_range: `${formData.currency} ${formData.payAmount}/${formData.payRate}`,
          salary_numeric: parseFloat(formData.payAmount) || null,
          employment_type: formData.jobType,
          status: formData.postingStatus,
          required_skills: finalSkills,
          priority: formData.positionStatus === 'Active Position',
          withdrawal_limit: parseInt(withdrawalLimit, 10),
          tags: formattedTags,
        })
        .eq('id', jobToEdit.id)
        .select()
        .maybeSingle();

      if (jobError) {
        console.error('Update job error:', jobError);
        alert('Error updating job: ' + jobError.message);
        setLoading(false);
        return;
      }

      if (!jobData) {
        console.error('Update job returned no data (possibly blocked by RLS or incorrect ID). Job ID:', jobToEdit.id);
        alert('Update failed: Could not save changes. You may not have permission to edit this job.');
        setLoading(false);
        return;
      }

      console.log('Update job success:', jobData);

      if (isTransitionToPublish && salaryNumericVal && salaryNumericVal > 0) {
        try {
          if (isCompany) {
            await deductJobPostingFee(currentIdentity.id, jobToEdit.id, salaryNumericVal);
          } else {
            await deductUserJobPostingFee(userId, jobToEdit.id, salaryNumericVal);
          }
        } catch (mcErr) {
          console.error('MCredit deduction failed during transition, rolling back job status:', mcErr);
          // Rollback: set status back to Draft in database
          await supabase.from('jobs').update({ status: 'Draft' }).eq('id', jobToEdit.id);
          alert('Job publishing failed: ' + (mcErr.message || 'Insufficient MCredits'));
          setLoading(false);
          return;
        }
      }

      setLoading(false);
      onComplete(jobData);
    } else {
      const salaryNumericVal = parseFloat(formData.payAmount) || null;

      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .insert({
          title: formData.title,
          description: formData.description,
          responsibilities: formData.responsibilities,
          location: formData.location,
          salary_range: `${formData.currency} ${formData.payAmount}/${formData.payRate}`,
          salary_numeric: salaryNumericVal,
          employment_type: formData.jobType,
          company_id: isCompany ? currentIdentity.id : null,
          poster_id: userId,
          status: formData.postingStatus,
          required_skills: finalSkills,
          priority: formData.positionStatus === 'Active Position',
          withdrawal_limit: parseInt(withdrawalLimit, 10),
          tags: formattedTags,
        })
        .select()
        .maybeSingle();

      if (jobError) {
        alert('Error creating job: ' + jobError.message);
        setLoading(false);
        return;
      }

      // MCredit deduction (only if not saving as Draft)
      if (formData.postingStatus !== 'Draft' && salaryNumericVal && salaryNumericVal > 0) {
        try {
          if (isCompany) {
            await deductJobPostingFee(currentIdentity.id, jobData.id, salaryNumericVal);
          } else {
            await deductUserJobPostingFee(userId, jobData.id, salaryNumericVal);
          }
        } catch (mcErr) {
          console.error('MCredit deduction failed, rolling back job:', mcErr);
          // Rollback: delete the inserted job
          await supabase.from('jobs').delete().eq('id', jobData.id);
          alert('Job posting failed: ' + (mcErr.message || 'Insufficient MCredits'));
          setLoading(false);
          return;
        }
      }

      const skillPills = finalSkills.length > 0
        ? finalSkills.map(s => `<span style="display:inline-block;background:#dbeafe;color:#1e40af;border:1px solid #bfdbfe;border-radius:9999px;padding:2px 10px;font-size:12px;font-weight:700;margin:2px;">${s}</span>`).join(' ')
        : '';
      const tagPills = formattedTags.length > 0
        ? formattedTags.map(t => `<span style="display:inline-block;background:#f0fdf4;color:#166534;border:1px solid #bbf7d0;border-radius:9999px;padding:2px 10px;font-size:12px;font-weight:700;margin:2px;">${t}</span>`).join(' ')
        : '';

      const postContent = [
        `<p><strong>⚓ New Job Opportunity</strong></p>`,
        `<p style="font-size:18px;font-weight:800;color:#000050;">${formData.title}</p>`,
        isCompany ? `<p style="color:#475569;font-size:14px;"><strong>Company:</strong> ${identityName}</p>` : '',
        formData.location ? `<p style="color:#475569;font-size:14px;"><strong>Location:</strong> ${formData.location}</p>` : '',
        skillPills ? `<p style="margin-top:8px;"><strong style="font-size:13px;color:#475569;">Required Skills:</strong><br/>${skillPills}</p>` : '',
        tagPills ? `<p style="margin-top:6px;"><strong style="font-size:13px;color:#475569;">Job Tags:</strong><br/>${tagPills}</p>` : '',
        `<p style="margin-top:12px;"><a href="/mservices/opportunity/${jobData.id}" style="color:#002b4e;font-weight:700;text-decoration:underline;">See More →</a></p>`,
      ].filter(Boolean).join('\n');

      const { error: postError } = await supabase
        .from('logbook_posts')
        .insert({
          user_id: userId,
          content: postContent,
          posted_as_company_id: isCompany ? currentIdentity.id : null,
          media_type: 'image'
        });

      if (postError) {
        console.error('Error creating feed post:', postError.message);
      }

      setLoading(false);
      onComplete(jobData);
    }
  };
  const isPublishingNewJob = !jobToEdit && (formData.postingStatus || '').toLowerCase() !== 'draft';
  const isTransitionToPublish = jobToEdit && ((jobToEdit.status || 'draft').toLowerCase() === 'draft') && ['published', 'open'].includes((formData.postingStatus || '').toLowerCase());
  const isPublishAction = isPublishingNewJob || isTransitionToPublish;

  return (
    <BaseModal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={jobToEdit ? "Edit Job Posting" : "Create Job Posting"}
      maxWidth="800px"
      disableBackdropClick={true}
    >
      <form id="post-job-form" onSubmit={handleSubmit} className="flex flex-col">
        {/* Header Icon Section */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-900">
            <Briefcase size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-blue-900">{jobToEdit ? "Edit Professional Job Form" : "Professional Job Form"}</h3>
            <p className="text-xs text-gray-500">Provide complete candidate, rate, and credential requirements.</p>
          </div>
        </div>

        {/* Form Fields Stack (Scrollable Container) - overflow-x-hidden prevents horizontal scrollbar on mobile */}
        <div className="max-h-[60vh] overflow-y-auto overflow-x-hidden pr-2 space-y-4 w-full">
          
          {/* Row 1: Job Title */}
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1.5">Job Title</label>
            <input 
              type="text" 
              name="title" 
              className="border border-gray-300 rounded-md p-2 text-sm w-full focus:ring-2 focus:ring-blue-900" 
              placeholder="e.g. Master Mariner, Chief Engineer"
              value={formData.title}
              onChange={handleInputChange}
              required
            />
          </div>

          {/* Row 2: Location and Start Date - stack on mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1.5">Job Location</label>
              <input 
                type="text" 
                name="location" 
                className="border border-gray-300 rounded-md p-2 text-sm w-full focus:ring-2 focus:ring-blue-900" 
                placeholder="e.g. London, Singapore, Remote"
                value={formData.location}
                onChange={handleInputChange}
                required
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1.5">Start Date</label>
              <input 
                type="date" 
                name="startDate" 
                className="border border-gray-300 rounded-md p-2 text-sm w-full focus:ring-2 focus:ring-blue-900" 
                value={formData.startDate}
                onChange={handleInputChange}
                required
              />
            </div>
          </div>

          {/* Row 3: Pay Rate Amount, Currency, Pay Rate Frequency - stack on mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1.5">Pay Rate Amount</label>
              <input 
                type="number" 
                name="payAmount" 
                className="border border-gray-300 rounded-md p-2 text-sm w-full focus:ring-2 focus:ring-blue-900" 
                placeholder="e.g. 50"
                value={formData.payAmount}
                onChange={handleInputChange}
                required
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1.5">Currency</label>
              <select 
                name="currency" 
                className="border border-gray-300 rounded-md p-2 text-sm w-full focus:ring-2 focus:ring-blue-900 bg-white" 
                value={formData.currency}
                onChange={handleInputChange}
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="SGD">SGD</option>
                <option value="PHP">PHP</option>
                <option value="INR">INR</option>
                <option value="KRW">KRW</option>
                <option value="CNY">CNY</option>
                <option value="JPY">JPY</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1.5">Pay Rate</label>
              <select 
                name="payRate" 
                className="border border-gray-300 rounded-md p-2 text-sm w-full focus:ring-2 focus:ring-blue-900 bg-white" 
                value={formData.payRate}
                onChange={handleInputChange}
              >
                <option value="Hour">Hour</option>
                <option value="Day">Day</option>
                <option value="Week">Week</option>
                <option value="Month">Month</option>
              </select>
            </div>
          </div>

          {/* Row 4: Job Type and Experience Level - stack on mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1.5">Job Type</label>
              <select 
                name="jobType" 
                className="border border-gray-300 rounded-md p-2 text-sm w-full focus:ring-2 focus:ring-blue-900 bg-white" 
                value={formData.jobType}
                onChange={handleInputChange}
              >
                <option value="Full-time">Full-time</option>
                <option value="Contract">Contract</option>
                <option value="Temporary">Temporary</option>
                <option value="Project-based">Project-based</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1.5">Experience Level</label>
              <select 
                name="experienceLevel" 
                className="border border-gray-300 rounded-md p-2 text-sm w-full focus:ring-2 focus:ring-blue-900 bg-white" 
                value={formData.experienceLevel}
                onChange={handleInputChange}
              >
                <option value="Junior">Junior</option>
                <option value="Mid">Mid</option>
                <option value="Senior">Senior</option>
                <option value="Specialist">Specialist</option>
              </select>
            </div>
          </div>

          {/* Row 5: Position Status and Posting Status - stack on mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1.5">Position Status</label>
              <select 
                name="positionStatus" 
                className="border border-gray-300 rounded-md p-2 text-sm w-full focus:ring-2 focus:ring-blue-900 bg-white" 
                value={formData.positionStatus}
                onChange={handleInputChange}
              >
                <option value="Active Position">Active Position</option>
                <option value="Inactive Position">Inactive Position</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1.5">Posting Status</label>
              <select 
                name="postingStatus" 
                className="border border-gray-300 rounded-md p-2 text-sm w-full focus:ring-2 focus:ring-blue-900 bg-white" 
                value={formData.postingStatus}
                onChange={handleInputChange}
              >
                <option value="Draft">Draft</option>
                <option value="Published">Published</option>
                <option value="Closed">Closed</option>
              </select>
            </div>
          </div>

          {/* Row 5b: Max Withdrawals Allowed */}
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1.5">
              Max Withdrawals Allowed
            </label>
            <input
              type="number"
              min="1"
              max="10"
              value={withdrawalLimit}
              onChange={(e) => setWithdrawalLimit(e.target.value)}
              className="border border-gray-300 rounded-md p-2 text-sm w-full focus:ring-2 focus:ring-blue-900 max-w-[120px]"
            />
            <p className="text-xs text-gray-400 mt-1.5">
              Limits how many times an applicant can withdraw and re-apply to prevent spam.
            </p>
          </div>

          {/* Row 5c: Job Tags (Optional) */}
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1.5">
              Job Tags (Optional)
            </label>
            <input 
              type="text" 
              className="border border-gray-300 rounded-md p-2 text-sm w-full focus:ring-2 focus:ring-blue-900" 
              placeholder="e.g., Engineer, Offshore, Contract"
              value={tagsString}
              onChange={(e) => setTagsString(e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1.5">
              Separate multiple tags with commas. These help candidates find your job.
            </p>
          </div>

          {/* Row 6: Required Skills */}
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1.5">Required Skills</label>
            <input 
              type="text" 
              className="border border-gray-300 rounded-md p-2 text-sm w-full focus:ring-2 focus:ring-blue-900" 
              placeholder={skills.length >= 5 ? 'Maximum skills reached' : 'Type and press enter (Max 5)'}
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={handleAddSkill}
              disabled={skills.length >= 5}
            />
            {skills.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {skills.map((skill, index) => (
                  <span 
                    key={index} 
                    className="flex items-center gap-1 bg-teal-50 border border-teal-200 text-teal-800 text-xs px-2.5 py-1 rounded-full font-medium"
                  >
                    {skill}
                    <button 
                      type="button" 
                      onClick={() => handleRemoveSkill(skill)}
                      className="hover:text-teal-950 font-bold focus:outline-none ml-0.5"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Row 7: Job Description */}
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1.5">Job Description</label>
            <div className="border border-gray-300 rounded-md bg-white focus-within:ring-2 focus-within:ring-blue-900 overflow-hidden rich-text-editor-container min-h-[220px] leading-relaxed">
              <RichTextEditor
                value={formData.description}
                onChange={(val) => setFormData(prev => ({ ...prev, description: val }))}
                placeholder="Describe the role and main responsibilities..."
              />
            </div>
          </div>

          {/* Row 8: Responsibilities */}
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1.5">Responsibilities</label>
            <div className="border border-gray-300 rounded-md bg-white focus-within:ring-2 focus-within:ring-blue-900 overflow-hidden rich-text-editor-container min-h-[220px] leading-relaxed">
              <RichTextEditor
                value={formData.responsibilities}
                onChange={(val) => setFormData(prev => ({ ...prev, responsibilities: val }))}
                placeholder="List key duties and performance expectations..."
              />
            </div>
          </div>

        </div>

        {/* MCredit Fee Preview Banner (Create mode only) */}
        {!jobToEdit && feePreview && (
          <div className={`rounded-xl p-4 mt-4 mb-2 border ${
            mcreditError 
              ? 'bg-red-50 border-red-200' 
              : 'bg-emerald-50 border-emerald-200'
          }`}>
            <div className="flex items-start gap-3">
              {mcreditError ? (
                <AlertTriangle size={18} className="text-red-600 shrink-0 mt-0.5" />
              ) : (
                <Coins size={18} className="text-emerald-700 shrink-0 mt-0.5" />
              )}
              <div className="text-sm">
                <p className="font-semibold text-gray-800">
                  Posting Fee: <span className="font-bold">{feePreview.fee.toFixed(2)} MC</span>
                  <span className="text-gray-500 font-normal"> ({feePreview.feePercent}% of {parseFloat(formData.payAmount).toLocaleString()})</span>
                </p>
                {walletBalance !== null && (
                  <p className="text-gray-600 mt-0.5">
                    {isCompany ? 'Company' : 'Personal'} Wallet: <span className="font-bold">{walletBalance.toFixed(2)} MC</span>
                  </p>
                )}
                {mcreditError && (
                  <p className="text-red-700 font-semibold mt-1">{mcreditError}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer Buttons Section */}
        <div className="flex flex-wrap items-center justify-end gap-3 mt-8 pt-4 border-t border-slate-200 w-full">
          <button 
            type="button"
            className="px-4 py-2 text-sm font-medium hover:bg-slate-100 rounded-lg text-gray-700" 
            onClick={onClose}
          >
            Cancel
          </button>
          <button 
            type="submit" 
            className="btn-primary-pill px-6" 
            disabled={loading || (isPublishAction && !!mcreditError)}
          >
            {loading ? (jobToEdit ? 'Saving...' : 'Posting...') : (jobToEdit ? 'Save Changes' : 'Create Job')}
          </button>
        </div>
      </form>
    </BaseModal>
  );
}
