// Run this script to seed test users
// Usage: npx tsx scripts/seed-users.ts

async function seedUsers() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  
  console.log('Seeding users...')
  
  const response = await fetch(`${baseUrl}/api/seed?secret=cloe-seed-2024`, {
    method: 'POST'
  })
  
  const data = await response.json()
  
  console.log('\n=== Resultado del Seed ===\n')
  
  if (data.created && data.created.length > 0) {
    console.log('USUARIOS CREADOS:')
    console.log('==================\n')
    
    // Group by role
    const byRole: Record<string, typeof data.created> = {}
    for (const user of data.created) {
      if (!byRole[user.role]) byRole[user.role] = []
      byRole[user.role].push(user)
    }
    
    for (const [role, users] of Object.entries(byRole)) {
      console.log(`\n--- ${role.toUpperCase()} ---`)
      for (const user of users as typeof data.created) {
        console.log(`  Email: ${user.email}`)
        console.log(`  Código: ${user.employee_code}`)
        console.log(`  Nombre: ${user.full_name}`)
        console.log(`  Contraseña: ${user.password}`)
        console.log('')
      }
    }
  }
  
  if (data.errors && data.errors.length > 0) {
    console.log('\nERRORES:')
    for (const err of data.errors) {
      console.log(`  ${err.email}: ${err.error}`)
    }
  }
  
  console.log('\n' + data.message)
}

seedUsers().catch(console.error)
