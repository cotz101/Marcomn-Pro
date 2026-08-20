ALTER TABLE group_posts 
DROP CONSTRAINT IF EXISTS group_posts_user_id_fkey,
ADD CONSTRAINT group_posts_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES auth.users(id)
ON DELETE CASCADE;;
