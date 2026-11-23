export function staffPhone(value) {
  const raw=String(value||'').trim();
  if(!/^\+?[\d ()-]+$/.test(raw))throw Error('Enter a valid phone number.');
  let digits=raw.replace(/\D/g,'');
  if(/^0[6-9]\d{9}$/.test(digits))digits=digits.slice(1);
  if(/^[6-9]\d{9}$/.test(digits))digits='91'+digits;
  if(!/^[1-9]\d{7,14}$/.test(digits) || (!raw.startsWith('+')&&!/^91[6-9]\d{9}$/.test(digits)))throw Error('Enter a 10-digit Indian mobile number, or + and the international country code.');
  return '+'+digits;
}
// Internal Auth identifier: customers and staff only enter their telephone number.
// No SMS provider or real email inbox is required for administrator-provisioned password accounts.
export function staffIdentity(phone) {return 'phone-'+staffPhone(phone).slice(1)+'@staff.sports-center.invalid';}
export function validateStaff(input) {
  const name=String(input.name||'').trim(),phone=staffPhone(input.phone),role=input.role;
  const password=String(input.password||'');
  if(!name || name.length>120)throw Error('Enter a staff name within 120 characters.');
  if(!['admin','technician'].includes(role))throw Error('Choose an administrator or technician role.');
  if(password.length<10 || new TextEncoder().encode(password).length>72 || !/[A-Za-z]/.test(password) || !/\d/.test(password))throw Error('Use a password of at least 10 characters with letters and numbers, within 72 bytes.');
  return {name,phone,role,password};
}
