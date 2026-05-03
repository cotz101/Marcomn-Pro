import { createClient } from '../lib/supabase.js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient();

async function testUpsert() {
  const userId = '169da610-86d1-4be3-85f2-95f00e99f69b'; // Example ID from logs
  const { data, error } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      full_name: 'Test Update'
    });

  if (error) {
    console.error('Upsert Error:', error);
  } else {
    console.log('Upsert Success:', data);
  }
}

testUpsert();
