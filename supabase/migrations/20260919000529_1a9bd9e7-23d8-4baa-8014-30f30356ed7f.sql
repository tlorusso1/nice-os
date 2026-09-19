SELECT cron.unschedule('sync-vendas-daily') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-vendas-daily');
SELECT cron.schedule(
  'sync-vendas-daily',
  '0 6 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://ibxzyodvtmagnetpyyfz.supabase.co/functions/v1/sync-vendas',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlieHp5b2R2dG1hZ25ldHB5eWZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MzYyNTAsImV4cCI6MjA4NTIxMjI1MH0.AdldVUwt3mqjvn8Ik4BTIB0wsckryhnzF_krmR06H28',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key'
      )
    ),
    body := '{"mode":"incremental"}'::jsonb
  );
  $cron$
);