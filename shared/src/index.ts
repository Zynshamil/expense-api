export type Category = { id: string; name: string; icon: string; color: string; subcategories: string[] };
export type Expense = { id: string; amount: number; title: string; categoryId: string; subcategory: string; date: string; payment: string; notes: string; createdAt: string };
export type Profile = { currency: string; budget: number; categories: Category[] };
export const currencies = ['INR','USD','EUR','GBP','AED','SAR','CAD','AUD','SGD'];
export const payments = ['UPI','Cash','Debit card','Credit card','Bank transfer','Other'];
export const colors = ['#e4a15b','#6e9ed4','#9c87c1','#d7808b','#5da994','#c1a45f','#8191bf','#75a9aa'];
export const defaultCategories: Category[] = [
 {id:'food',name:'Food & drinks',icon:'utensils',color:'#e4a15b',subcategories:['Breakfast','Lunch','Dinner','Tea & coffee','Snacks','Food shopping','Food delivery','Dining out']},
 {id:'transport',name:'Transport',icon:'car',color:'#6e9ed4',subcategories:['Fuel','Bus','Train & metro','Taxi & rideshare','Parking','Tolls','Vehicle maintenance','Vehicle insurance']},
 {id:'home',name:'Home',icon:'home',color:'#9c87c1',subcategories:['Rent','Mortgage','Repairs','Furniture','Appliances','Cleaning','Home supplies']},
 {id:'bills',name:'Bills & utilities',icon:'zap',color:'#d7808b',subcategories:['Electricity','Water','Gas','Internet','Mobile recharge','TV & cable','Waste collection']},
 {id:'shopping',name:'Shopping',icon:'bag',color:'#5da994',subcategories:['Clothing','Footwear','Electronics','Accessories','Beauty products','General shopping']},
 {id:'health',name:'Health & wellness',icon:'heart',color:'#c1a45f',subcategories:['Doctor','Medicines','Dental','Eye care','Health insurance','Gym & fitness','Therapy','Tests & scans']},
 {id:'entertainment',name:'Entertainment',icon:'film',color:'#8191bf',subcategories:['Movies','Streaming','Music','Games','Events','Hobbies','Books']},
 {id:'travel',name:'Travel',icon:'plane',color:'#75a9aa',subcategories:['Flights','Accommodation','Local transport','Activities','Visa & fees','Travel insurance','Travel food']},
 {id:'education',name:'Education',icon:'book',color:'#9c87c1',subcategories:['Tuition','Courses','School supplies','Books & materials','Exams','Coaching']},
 {id:'personal',name:'Personal care',icon:'sparkles',color:'#d7808b',subcategories:['Haircut','Salon','Skincare','Toiletries','Laundry']},
 {id:'family',name:'Family & children',icon:'users',color:'#6e9ed4',subcategories:['Childcare','Baby supplies','School fees','Toys','Elder care','Family support']},
 {id:'pets',name:'Pets',icon:'paw',color:'#c1a45f',subcategories:['Pet food','Vet','Grooming','Pet supplies','Pet boarding']},
 {id:'gifts',name:'Gifts & donations',icon:'gift',color:'#e4a15b',subcategories:['Gifts','Charity','Celebrations','Religious giving']},
 {id:'subscriptions',name:'Subscriptions',icon:'repeat',color:'#75a9aa',subcategories:['Software','Apps','Memberships','News & magazines','Cloud storage']},
 {id:'work',name:'Work & business',icon:'briefcase',color:'#8191bf',subcategories:['Office supplies','Equipment','Business travel','Professional fees','Coworking','Client meals']},
 {id:'finance',name:'Financial expenses',icon:'landmark',color:'#5da994',subcategories:['Bank fees','Loan repayment','Interest','Taxes','Insurance','Service charges']},
 {id:'other',name:'Other',icon:'more',color:'#929ba0',subcategories:['Miscellaneous','Unplanned expense','Other']},
];
