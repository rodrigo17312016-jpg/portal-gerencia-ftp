// Supabase Configuration
const SUPABASE_URL = 'https://obnvrfvcujsrmifvlqni.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ibnZyZnZjdWpzcm1pZnZscW5pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1MDY3OTUsImV4cCI6MjA4OTA4Mjc5NX0.A7BilSrDzqe2rqz1Kh8fg5t-GVNxrLGYJK4IaMlVtBs';
const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;
