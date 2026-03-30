import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://gzgxqjxbgihzsvrwivmd.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6Z3hxanhiZ2loenN2cndpdm1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4ODI2MTksImV4cCI6MjA5MDQ1ODYxOX0.0jJMLQySt1ESeS_kdZrcd8RDVRYeuR6UdJc1BM1eKYU";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
