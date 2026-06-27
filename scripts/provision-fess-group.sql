DO $$
DECLARE
  v_org_id uuid;
  v_owner uuid := '77bff40a-7f1b-465e-a19b-ac7b286fbb1c';
BEGIN
  SELECT id INTO v_org_id FROM public.organizations WHERE slug = 'fess-group' LIMIT 1;
  IF v_org_id IS NULL THEN
    INSERT INTO public.organizations (slug, name, owner_user_id)
    VALUES ('fess-group', 'FESS Group', v_owner)
    RETURNING id INTO v_org_id;
  ELSE
    UPDATE public.organizations SET name = 'FESS Group' WHERE id = v_org_id;
  END IF;

  INSERT INTO public.org_memberships (user_id, org_id, role)
  VALUES
    ('77bff40a-7f1b-465e-a19b-ac7b286fbb1c', v_org_id, 'admin'),
    ('c9abaf07-9fdd-490d-8d21-74cc4dd35515', v_org_id, 'admin')
  ON CONFLICT (user_id) DO UPDATE
    SET org_id = excluded.org_id,
        role = excluded.role;
END $$;

SELECT o.slug, o.name, u.email, m.role
FROM public.org_memberships m
JOIN public.organizations o ON o.id = m.org_id
JOIN auth.users u ON u.id = m.user_id
WHERE o.slug = 'fess-group'
ORDER BY u.email;
