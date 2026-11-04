-- Les comptes créés avant l'installation du schéma n'ont pas déclenché handle_new_user.
insert into public.profiles (id, display_name)
select id, coalesce(raw_user_meta_data ->> 'display_name', split_part(email, '@', 1))
from auth.users
on conflict (id) do nothing;
