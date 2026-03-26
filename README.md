Vi-Notes

Features Implemented

1. Simple Text Editor
Clean and distraction-free writing interface.
Built using a <textarea> for reliability and simplicity.
Designed as the primary space for user content creation.
No formatting options (intentional design choice to focus on raw writing behavior). 

2. User Authentication (Basic)
User registration using email and password.
Secure login functionality.
Passwords hashed using bcryptjs.
JWT-based authentication for session handling.

3. Protected Writing Access
Only authenticated users can access the editor.
Token stored in browser (localStorage).
Route protection implemented using conditional rendering.

----------------------------------------------------------------------------------------------------------------------------------------------------

Setup Instructions
1. Clone the repository
git clone https://github.com/Ananya131213/vi-notes.git
cd vi-notes
2. Setup Backend
cd server
npm install
npm run dev
3. Setup Frontend
cd client
npm install
npm start
4. Access the App

Open:

http://localhost:3000

----------------------------------------------------------------------------------------------------------------------------------------------------
