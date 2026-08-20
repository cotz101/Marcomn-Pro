CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, avatar_url)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', 'New Member'),
    COALESCE(new.raw_user_meta_data->>'avatar_url', 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y')
  );
  RETURN new;
END;
$$;;
