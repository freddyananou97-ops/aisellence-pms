import { supabase } from './supabase'

/**
 * Get the effective price for a room category on a given date.
 * Checks rate_rules (highest priority wins), falls back to base_price.
 */
export async function getEffectivePrice(categoryId, date) {
  // Get category base price
  const { data: cat } = await supabase.from('room_categories').select('base_price, name').eq('id', categoryId).single()
  if (!cat) return { price: 0, source: 'unknown', category: '' }

  const basePrice = parseFloat(cat.base_price) || 0

  // Get active rules for this date + category (or rules for all categories)
  const { data: rules } = await supabase.from('rate_rules').select('*')
    .eq('active', true).lte('start_date', date).gte('end_date', date)
    .order('priority', { ascending: false })

  if (!rules || rules.length === 0) return { price: basePrice, source: 'base', category: cat.name }

  // Find matching rule (category-specific first, then general)
  const categoryRule = rules.find(r => r.category_id === categoryId)
  const generalRule = rules.find(r => !r.category_id)
  const rule = categoryRule || generalRule

  if (!rule) return { price: basePrice, source: 'base', category: cat.name }

  let price = basePrice
  if (rule.price_type === 'fixed') {
    price = parseFloat(rule.price_value)
  } else if (rule.price_type === 'percentage') {
    price = basePrice * (1 + parseFloat(rule.price_value) / 100)
  }

  return { price: Math.round(price * 100) / 100, source: rule.type, ruleName: rule.name, category: cat.name }
}

/**
 * Get effective prices for all categories on a date.
 */
export async function getAllPrices(date) {
  const { data: categories } = await supabase.from('room_categories').select('*').eq('active', true).order('base_price')
  if (!categories) return []

  const { data: rules } = await supabase.from('rate_rules').select('*')
    .eq('active', true).lte('start_date', date).gte('end_date', date)
    .order('priority', { ascending: false })

  return categories.map(cat => {
    const categoryRule = (rules || []).find(r => r.category_id === cat.id)
    const generalRule = (rules || []).find(r => !r.category_id)
    const rule = categoryRule || generalRule

    let price = parseFloat(cat.base_price) || 0
    let source = 'base'
    if (rule) {
      source = rule.type
      if (rule.price_type === 'fixed') price = parseFloat(rule.price_value)
      else if (rule.price_type === 'percentage') price = price * (1 + parseFloat(rule.price_value) / 100)
    }

    return { ...cat, effectivePrice: Math.round(price * 100) / 100, source, ruleName: rule?.name }
  })
}
