import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { useProfile } from '@/app/context/ProfileContext';
import BaseModal from '../layout/BaseModal';
import RichTextEditor from '../common/RichTextEditor';
import { Briefcase } from 'lucide-react';

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

  const isCompany = currentIdentity?.type === 'company';
  const identityName = isCompany ? currentIdentity.data.name : (profile?.fullName || 'Anonymous');

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    if (!formData.title || !formData.location || !formData.startDate || !formData.payAmount || !formData.description || !formData.responsibilities) {
      alert('Please fill in all required fields.');
      return;
    }

    setLoading(true);
    const supabase = createClient();

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
      skills: skills,
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
          employment_type: formData.jobType,
          status: formData.postingStatus,
          required_skills: skills,
          priority: formData.positionStatus === 'Active Position',
          withdrawal_limit: parseInt(withdrawalLimit, 10),
          tags: formattedTags,
        })
        .eq('id', jobToEdit.id)
        .select()
        .maybeSingle();

      if (jobError) {
        alert('Error updating job: ' + jobError.message);
        setLoading(false);
        return;
      }

      setLoading(false);
      onComplete(jobData);
    } else {
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .insert({
          title: formData.title,
          description: formData.description,
          responsibilities: formData.responsibilities,
          location: formData.location,
          salary_range: `${formData.currency} ${formData.payAmount}/${formData.payRate}`,
          employment_type: formData.jobType,
          company_id: isCompany ? currentIdentity.id : null,
          poster_id: userId,
          status: formData.postingStatus,
          required_skills: skills,
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

      const postContent = `⚓ New Opportunity Alert: ${formData.title} at ${identityName}! We are looking for top maritime talent... [link](route:/mservices/opportunity/${jobData.id})`;
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
            disabled={loading}
          >
            {loading ? (jobToEdit ? 'Saving...' : 'Posting...') : (jobToEdit ? 'Save Changes' : 'Create Job')}
          </button>
        </div>
      </form>
    </BaseModal>
  );
}
