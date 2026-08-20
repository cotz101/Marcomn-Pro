ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS previous_role text,
ADD COLUMN IF NOT EXISTS skills text[],
ADD COLUMN IF NOT EXISTS is_sailing boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS vessel_name text,
ADD COLUMN IF NOT EXISTS open_to_work boolean DEFAULT false;
;
