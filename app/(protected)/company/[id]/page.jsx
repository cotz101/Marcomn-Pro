'use client';
import { useEffect, useState, use } from 'react';
import { createClient } from '@/lib/supabase';
import { useProfile } from '@/app/context/ProfileContext';
import CompanyProfile from '@/src/components/company/CompanyProfile';

export default function CompanyPage({ params: paramsPromise }) {
  const params = use(paramsPromise);
  const { id } = params;
  const { userId } = useProfile();
  const [company, setCompany] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (!id || !userId) return;
      
      const supabase = createClient();
      
      // Fetch company data
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (companyData && !companyError) {
        setCompany(companyData);
      }
      
      // Fetch user role for this company
      const { data: memberData, error: memberError } = await supabase
        .from('company_members')
        .select('role')
        .eq('company_id', id)
        .eq('profile_id', userId)
        .maybeSingle();
      
      if (memberData && !memberError) {
        setRole(memberData.role);
      }
      
      setLoading(false);
    }
    
    fetchData();
  }, [id, userId]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!company) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <h1>Company not found</h1>
        <p>The company you are looking for does not exist or has been deleted.</p>
      </div>
    );
  }

  return (
    <CompanyProfile 
      company={company} 
      role={role} 
      onUpdate={(newData) => setCompany(prev => ({ ...prev, ...newData }))} 
    />
  );
}
