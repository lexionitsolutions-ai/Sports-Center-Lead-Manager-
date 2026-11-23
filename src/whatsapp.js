export const WHATSAPP_SENDER = 'Mayuri Patil';
const messages = {
 'Gym machinery': `We are glad to hear about your gym machinery requirements. Whether you are adding a few machines or upgrading your current gym, we would be happy to help you choose equipment that suits your members, available space and budget. We can share machine dimensions, specifications and a quotation for the options you shortlist.

Here is a list of our previous work for your reference (demo examples):
- Prime Strength Studio - strength training machinery.
- Core Fit Gym - cardio equipment and free weights.

Please share the machines you are looking for, your location and an approximate budget. This will help us get back to you promptly with relevant options and the next steps.`,
 'Professional gym setup': `We are excited to hear about your plans for a professional gym. From choosing the right mix of machines to planning strength, cardio and free-weight areas, we would be happy to help you put together a setup that works for your space, members and budget.

Here is a list of our previous work for your reference (demo examples):
- Apex Fitness Hub - complete commercial gym setup.
- Peak Performance Studio - strength and cardio training areas.

Please share your location, floor area, approximate budget and planned opening date. We can then discuss your requirements, suggest an equipment list and prepare a quotation to help move your project forward.`,
 'Home gym setup': `We would love to help you create a home gym that makes it easier to stay active in your own space. Whether you prefer cardio, strength training or a combination of both, we can suggest equipment around your fitness goals, room dimensions and budget.

Here is a list of our previous work for your reference (demo examples):
- Urban Nest Home Gym - compact strength training setup.
- Private Fitness Room - home cardio and free-weight equipment.

Please share your available space, preferred workouts and approximate budget. A room photo or its dimensions would also help us suggest practical options and prepare a personalised quotation for you.`,
 'School equipment': `Thank you for considering us for your school or college's sports and fitness requirements. We would be happy to help you select equipment for physical education, student activities and training, based on the age groups, available facilities and quantities you need.

Here is a list of our previous work for your reference (demo examples):
- Greenfield Academy - sports and fitness equipment.
- Horizon College - physical education and training equipment.

Please share your institution name, equipment list, required quantities and preferred delivery timeline. We can then put together suitable options and a quotation for your team to review.`,
 'Sports equipment': `We are happy to help with your sports equipment requirements. Whether you are purchasing for individual practice, a team, a club or a training academy, we can help you compare suitable options around the sports you play, your training needs and your budget.

Here is a list of our previous work for your reference (demo examples):
- Ace Sports Club - team sports equipment.
- Community Sports Academy - practice and training equipment.

Please share the sports, equipment types, quantities and any preferred specifications. We will be happy to prepare a relevant selection and quotation, and discuss your required timeline with you.`,
};
export function inquiryMessage(inquiry, sender=WHATSAPP_SENDER) {
 const body=messages[inquiry.reason]||`We are glad to hear about your interest in ${inquiry.other_reason?.trim()||'our products and services'}. We would be happy to learn more about what you have in mind and help you explore options that suit your space, purpose and budget.

Here is a list of our previous work for your reference (demo examples):
- Active Life Project - customised equipment selection.
- Community Activity Space - sports and fitness equipment.

Please share a few details about your requirements, your location and your preferred timeline. If you have a reference photo or equipment list, feel free to send it across so we can guide you and prepare suitable options.`;
 return `Hi ${inquiry.name.trim()},\n\nThank you for enquiring at Sports Center! This is ${sender.trim()}, and it is a pleasure to connect with you.\n\n${body}\n\nThank you again for considering Sports Center. We look forward to working with you and helping you get started as soon as possible.\n\nWarm regards,\n${sender.trim()}\nSports Center`;
}
export function whatsappNumber(value) {
 const raw=String(value||'').trim(),digits=raw.replace(/\D/g,'');
 if(!/^\+?[\d ()-]+$/.test(raw))throw Error('Enter a valid WhatsApp number.');
 if(/^[6-9]\d{9}$/.test(digits))return `91${digits}`;
 if(/^0[6-9]\d{9}$/.test(digits))return `91${digits.slice(1)}`;
 if(/^91[6-9]\d{9}$/.test(digits))return digits;
 if(raw.startsWith('+')&&/^[1-9]\d{7,14}$/.test(digits))return digits;
 throw Error('Enter a 10-digit Indian mobile number or an international number with + and country code.');
}
export function whatsappLink(phone,message) {
 if(!message?.trim())throw Error('Enter a message before opening WhatsApp.');
 return `https://wa.me/${whatsappNumber(phone)}?text=${encodeURIComponent(message.trim())}`;
}
