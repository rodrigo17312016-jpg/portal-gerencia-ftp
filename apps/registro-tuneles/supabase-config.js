// Supabase Configuration - Proyecto Produccion
const SUPABASE_URL = 'https://rslzosmeteyzxmgfkppe.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzbHpvc21ldGV5enhtZ2ZrcHBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0OTc5NTgsImV4cCI6MjA5MDA3Mzk1OH0.XwitsLRWq10UsYshg_m2ViZh4BnV48zkJCK-JsRa9cs';
const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;
