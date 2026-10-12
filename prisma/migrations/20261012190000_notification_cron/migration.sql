-- Каждые 5 минут Cron вызывает Edge Function, если в Vault лежат секреты.
-- Пока их нет, тик ничего не делает.
-- notifications_url = https://<project-ref>.supabase.co/functions/v1/notifications
-- cron_secret = то же значение, что CRON_SECRET у функции.

CREATE OR REPLACE FUNCTION public.run_notification_tick()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net, vault, extensions
AS $$
DECLARE
  target text;
  secret text;
BEGIN
  IF to_regnamespace('vault') IS NULL OR to_regnamespace('net') IS NULL THEN
    RETURN;
  END IF;
  SELECT decrypted_secret INTO target FROM vault.decrypted_secrets WHERE name = 'notifications_url';
  SELECT decrypted_secret INTO secret FROM vault.decrypted_secrets WHERE name = 'cron_secret';
  IF target IS NULL OR secret IS NULL OR target = '' OR secret = '' THEN
    RETURN;
  END IF;
  PERFORM net.http_post(
    url := target,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || secret
    ),
    body := '{}'::jsonb
  );
END;
$$;

REVOKE ALL ON FUNCTION public.run_notification_tick() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.run_notification_tick() FROM anon;
REVOKE ALL ON FUNCTION public.run_notification_tick() FROM authenticated;

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  CREATE EXTENSION IF NOT EXISTS pg_net;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'notification cron extensions: %', SQLERRM;
END $$;

DO $$
DECLARE
  existing bigint;
BEGIN
  IF to_regnamespace('cron') IS NULL OR to_regnamespace('net') IS NULL THEN
    RAISE NOTICE 'notification cron skipped';
    RETURN;
  END IF;
  SELECT jobid INTO existing FROM cron.job WHERE jobname = 'notifications';
  IF existing IS NOT NULL THEN
    PERFORM cron.unschedule(existing);
  END IF;
  PERFORM cron.schedule('notifications', '*/5 * * * *', 'SELECT public.run_notification_tick()');
END $$;
