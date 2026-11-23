export const PRIMARY_PAGES=['dashboard','inquiries','followups','services','quotations'];
export const TOOL_PAGES=['services','deliveries','agent','staff','machines'];
export const HOME_PAGE='dashboard';
export function homeForRole(role){return role==='technician'?'services':HOME_PAGE;}
export function primaryForRole(role){return role==='admin'?PRIMARY_PAGES:['services'];}
export function toolsForRole(role){return role==='admin'?TOOL_PAGES:['services'];}
