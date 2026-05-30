/**
 * Fixes the MONGODB_URI in backend/.env
 * Run from backend folder: node fix_env.js
 */
const fs   = require('fs')
const path = require('path')

const envPath = path.join(__dirname, '.env')
let content   = fs.readFileSync(envPath, 'utf8')

console.log('Current MONGODB_URI:')
const currentLine = content.split('\n').find(l => l.startsWith('MONGODB_URI'))
console.log(currentLine)
console.log()

// Replace whatever MONGODB_URI is there with the correct SRV format
content = content.replace(
  /MONGODB_URI=.*/,
  'MONGODB_URI=mongodb+srv://nikhilborse:nikhil123@ac-mjuz3vl.5wfgred.mongodb.net/melodai?retryWrites=true&w=majority'
)

fs.writeFileSync(envPath, content, 'utf8')

console.log('Fixed MONGODB_URI:')
const newLine = content.split('\n').find(l => l.startsWith('MONGODB_URI'))
console.log(newLine)
console.log()
console.log('Done! Now run: python run.py')