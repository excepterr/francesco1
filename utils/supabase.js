const { createClient } = require('@supabase/supabase-js');
const config = require('../config.json');

const supabase = createClient(config.supabaseUrl, config.supabaseKey);

module.exports = supabase;