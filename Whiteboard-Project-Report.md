BTECH_CSE-607P Project Report
On
Whiteboard - Collaborative Online Whiteboard Application

Submitted to Rashtrasant Tukadoji Maharaj Nagpur University, Nagpur in partial fulfillment of requirement for the award of the degree of
BACHELOR OF TECHNOLOGY
in
COMPUTER SCIENCE & ENGINEERING

Submitted By
[Student Name 1]
[Student Name 2]
[Student Name 3]
[Student Name 4]

Under the Guidance of
Prof. [Guide's Name]
Assistant Professor

Department of Computer Science & Engineering
NAGPUR INSTITUTE OF TECHNOLOGY
Mahurzari, Katol Road Nagpur-441501
Rashtrasant Tukadoji Maharaj Nagpur University, Nagpur
2024-2025

DECLARATION

We hereby declare that the Project Report entitled "Whiteboard - Collaborative Online Whiteboard Application" submitted herein has been carried out by us in the Department of Computer Science & Engineering at Nagpur Institute of Technology, Nagpur. The presented work is original and has not been submitted earlier as a whole or in part for the award of any degree / diploma at this or any other Institution / University.
We also hereby assign to the Department of Computer Science & Engineering of Nagpur Institute of Technology, Nagpur all rights under copyright that may exist in and to the above work and any revised or expanded derivatives works based on the work as mentioned. Other work copied from references, manuals etc. are disclaimed.
Sr. No. Name of the Students Signature
1 [Student Name 1]
2 [Student Name 2]
3 [Student Name 3]
4 [Student Name 4]
Date: - / / 2025

Department of Computer Science & Engineering
NAGPUR INSTITUTE OF TECHNOLOGY
Mahurzari, Katol Road Nagpur-441501
Rashtrasant Tukadoji Maharaj Nagpur University, Nagpur
2024-2025

CERTIFICATE

This is to certify that the BTECH_CSE-607P Project Report entitled

"Whiteboard - Collaborative Online Whiteboard Application"
is a bonafide work and is submitted to Rashtrasant Tukadoji Maharaj Nagpur University, Nagpur

By

[Student Name 1]
[Student Name 2]
[Student Name 3]
[Student Name 4]

in partial fulfillment of requirement for the award of the degree of
Bachelor of Engineering in Computer Science & Engineering
during the academic year 2024-2025 under my guidance.

Mr. [Guide's Name] Dr. [Coordinator's Name]
Guide Project Coordinator Head
Assistant Professor Assistant Professor Associate Professor

Dr. [Principal's Name]
Principal
Nagpur Institute of Technology

Department of Computer Science & Engineering
NAGPUR INSTITUTE OF TECHNOLOGY
Mahurzari, Katol Road Nagpur-441501
Rashtrasant Tukadoji Maharaj Nagpur University, Nagpur
2024-2025

PROJECT REPORT APPROVAL SHEET

Project Report Entitled

"Whiteboard - Collaborative Online Whiteboard Application"

By

[Student Name 1]
[Student Name 2]
[Student Name 3]
[Student Name 4]

is presented and approved for the degree of

BACHELOR OF TECHNOLOGY
in
Computer Science & Engineering
of
Rashtrasant Tukadoji Maharaj Nagpur University, Nagpur

2024-2025

(Signature) (Signature)
Internal Examiner External Examiner
(Name) (Name)

Date: Date:

ACKNOWLEDGEMENT

"Whiteboard - Collaborative Online Whiteboard Application"
It gives us immense pleasure to express our gratitude to Prof. [Guide's Name]. Project Coordinator, who provided us constructive criticism and continuous guiding throughout the year during this project work.
We are indebted to Dr. [Coordinator's Name], Head, Department of Computer Science & Engineering who were always there whenever we needed any help. Without him and his co-operation, completion of this project work would have been inevitable and his presence behind us is totally indispensable.
We also express our sincere gratitude to our respected Principal, Dr. [Principal's Name] for providing us necessary facilities.
Our sincere thanks to the teaching and supporting staff of "Computer Science & Engineering", without their help, we could not have even conceived the accomplishment of this report. This work is virtually the result of their inspiration and guidance.
We would also like to thank the entire Library Staff and all those who directly or indirectly were the part of this work. We are also thankful to our parents whose best wishes are always with us.

Signed By

[Student Name 1]
[Student Name 2]
[Student Name 3]
[Student Name 4]

Sixth Semester,
B.Tech. Computer Science & Engineering

ABSTRACT

This project report details the development of "Collaboard," a real-time collaborative online whiteboard application. The application enables multiple users to simultaneously draw, interact, and brainstorm in a shared digital space. The frontend is built using HTML5, CSS3, and JavaScript, leveraging libraries such as Socket.IO for real-time communication to ensure low-latency drawing synchronization. The backend is developed with Node.js and Express, utilizing MongoDB for persistent storage of board data and JWT for secure user authentication and authorization. Key features include user authentication, real-time drawing synchronization, basic shape tools, and a responsive design. The application aims to provide a seamless and intuitive collaborative experience for remote teams and educational purposes, with a focus on scalability, maintainability, and security. The system is designed using industry-standard technologies and best practices to ensure a robust and reliable platform.

CONTENTS
Chapter No. Title Page No.
Declaration i
Certificate ii
Project Report Approval Sheet iii
Acknowledgement iv
Abstract v
List of Acronyms viii
List of Figures ix
List of Publications Xi
1 INTRODUCTION 1
1.1 Information about Project 1
1.1.1 Basic Concepts 1
1.1.2 Key Features 2
1.2 Information about Industry 3
1.2.1 Online Collaboration Tools 3
1.2.1.1 Real-time Whiteboarding 4
1.2.1.2 Remote Collaboration 5
1.2.1.3 Educational Applications 6
1.2.1.4 Business Applications 7
1.2.1.5 Design and Prototyping 8
1.3 Need of Project 8
2 LITERATURE REVIEW 10
2.1 Different Techniques 10
2.2 Our Findings 20
2.3 Motivation 20
3 IDENTIFICATION OF PROBLEM 21
3.1 Problem Analysis 21
3.2 Objectives 22
4 Implementation 23
4.1 Working Principle 23
4.2 Processes 24
4.3 Components & Constructional Details 25
5 CALCULATION AND SPECIFICATION 34
5.1 Experimental Setup 34
5.2 Experimental Results 35
5.3 Discussion 48
6 CONCLUSION AND FUTURE SCOPE 49
6.1Conclusion 49
6.2 Future Scope 50
REFERENCES 51
7 Output Screen shots
Soft Copy of project (PD )

LIST OF ACRONYMS
Serial No. Acronym Full Form
1 HTML HyperText Markup Language
2 CSS Cascading Style Sheets
3 JS JavaScript
4 API Application Programming Interface
5 UI User Interface
6 UX User Experience
7 REST Representational State Transfer
8 JSON JavaScript Object Notation
9 JWT JSON Web Token

Chapter 1

INTRODUCTION

This chapter provides an overview of the "Collaboard" project, a real-time collaborative online whiteboard application. It outlines the project's objectives, scope, and significance, detailing the technologies used and the challenges encountered during development.

1.1 Information about Project
The "Collaboard" project aims to create a collaborative online whiteboard application that allows multiple users to draw and interact in real-time. The application is designed to be user-friendly and accessible from any device with a web browser.

1.1.1 Basic Concepts
The application is built upon several core concepts:

- Real-time Collaboration: Multiple users can simultaneously interact with the whiteboard, seeing each other's drawings and edits in real-time. This is achieved using WebSockets, which provide a persistent connection between the client and server.
- User Authentication: Secure user registration and login system using JWT to protect user data and ensure only authorized users can access the application.
- Drawing Tools: A variety of drawing tools are available, including brushes, shapes, and text, allowing users to express their ideas in a variety of ways.
- Board Persistence: Whiteboard data is stored in a MongoDB database for later access, ensuring that users can resume their work at any time.

  1.1.2 Key Features
  The key features of the "Collaboard" application include:

- Real-time drawing and collaboration using Socket.IO: Socket.IO enables bidirectional communication between the client and server, allowing for instant updates across all connected clients.
- User authentication and authorization using JWT: JWT is used to secure the application and ensure that only authorized users can access the whiteboard. The JWT_SECRET environment variable is used to sign and verify the tokens.
- Basic drawing tools such as brush, line, rectangle, circle, and text: These tools allow users to create a variety of drawings and diagrams on the whiteboard.
- Color and size selection for drawing tools: Users can customize the appearance of their drawings by selecting different colors and sizes.
- Clear canvas functionality: Users can clear the entire canvas with a single click.
- Responsive design for accessibility on various devices: The application is designed to be accessible from any device with a web browser, including desktops, laptops, tablets, and smartphones.
- Board persistence using MongoDB: Whiteboard data is stored in a MongoDB database, allowing users to resume their work at any time. The MONGODB_URI environment variable is used to connect to the database.

  1.2 Information about Industry
  Online collaboration tools have become increasingly important in both educational and professional settings. The "Collaboard" project addresses the need for a simple yet powerful tool that facilitates real-time collaboration and idea sharing.

  1.2.1 Online Collaboration Tools
  Online collaboration tools are software applications that enable multiple users to work together on a shared project or task, regardless of their physical location. These tools typically provide features such as real-time communication, file sharing, and task management.

  1.2.1.1 Real-time Whiteboarding
  Real-time whiteboarding is a specific type of online collaboration tool that allows users to draw and interact on a shared digital canvas. This can be useful for brainstorming, problem-solving, and visual communication.

  1.2.1.2 Remote Collaboration
  Remote collaboration refers to the ability of teams to work together effectively, even when they are not in the same physical location. Online collaboration tools, including real-time whiteboarding applications, play a crucial role in enabling remote collaboration.

  1.2.1.3 Educational Applications
  Online whiteboards can be used in educational settings to facilitate remote learning, tutoring, and collaborative projects. Students and teachers can use the whiteboard to share ideas, solve problems, and create visual presentations.

  1.2.1.4 Business Applications
  In business settings, online whiteboards can be used for brainstorming, project planning, and team meetings. They provide a visual space for teams to collaborate and share ideas, regardless of their location.

  1.2.1.5 Design and Prototyping
  Online whiteboards can also be used for design and prototyping, allowing designers and developers to collaborate on visual designs and create interactive prototypes.

  1.3 Need of Project
  The "Collaboard" project addresses the need for a simple, intuitive, and accessible online whiteboard application that can be used in a variety of settings. The project aims to provide a user-friendly platform for real-time collaboration and idea sharing. The increasing demand for remote collaboration tools, especially in educational and business sectors, highlights the importance of this project.

Chapter 2

LITERATURE REVIEW

This chapter presents a review of existing literature and technologies related to online collaboration tools and real-time web applications. The chapter also discusses the advantages and limitations of different approaches and how they influenced the design of the Whiteboard application.

2.1 Different Techniques
Several techniques were considered for implementing the real-time collaboration features of the Whiteboard application. These include:

- Polling: Regularly checking the server for updates
- Long Polling: Keeping a connection open until new data is available
- Server-Sent Events: One-way communication from server to client
- WebSockets: Full-duplex communication between client and server

After evaluating these techniques, WebSockets were chosen for their efficiency and low latency in real-time communication.

2.2 Our Findings
Our research indicated that WebSockets provide the most efficient and reliable solution for real-time communication in a collaborative whiteboard application. Other techniques, such as polling and server-sent events, were found to be less suitable due to their higher latency and increased server load.

2.3 Motivation
The motivation behind the "Collaboard" project is to provide a user-friendly and accessible platform for real-time collaboration and idea sharing. The project aims to address the growing need for remote collaboration tools in educational and business settings.

Chapter 3

IDENTIFICATION OF PROBLEM

This chapter discusses the problem statement and objectives of the Whiteboard project. The chapter also outlines the challenges faced in developing a real-time collaborative application and how they were addressed.

3.1 Problem Analysis
The main challenges in developing the Whiteboard application included:

- Ensuring real-time synchronization of drawings across multiple clients: This requires careful management of WebSocket connections and efficient data transfer.
- Handling concurrent user connections efficiently: The server must be able to handle a large number of concurrent connections without performance degradation.
- Providing a responsive and intuitive user interface: The user interface must be easy to use and provide a seamless drawing experience.
- Maintaining application security and data integrity: The application must be protected against unauthorized access and data breaches.

  3.2 Objectives
  The primary objectives of the Whiteboard project are:

- To develop a web-based collaborative whiteboard application
- To implement real-time synchronization using WebSockets
- To create a user-friendly interface with various drawing tools
- To ensure the application is scalable and can handle multiple users

Chapter 4

METHODOLOGY

This chapter describes the methodology used in the development of the Whiteboard application. The chapter includes details about the system architecture, technologies used, and the development process.

4.1 Working Principle
The Whiteboard application follows a client-server architecture. The frontend is built using HTML, CSS, and JavaScript, while the backend is implemented using Node.js and Express. Real-time communication is handled using WebSockets, allowing for instant updates across all connected clients.

4.2 Processes
The development process involved several stages:

1. Requirement analysis and project planning
2. Design of the user interface and system architecture
3. Implementation of frontend and backend components
4. Integration of real-time communication using WebSockets
5. Testing and debugging
6. Deployment and user feedback collection

4.3 Components & Constructional Details
The application consists of several key components:

- Frontend:
  - HTML: Provides the structure and layout of the user interface, including the canvas element for drawing and the toolbar for selecting tools.
  - CSS: Styles the user interface and ensures a responsive design, using styles from `styles.css`, `board.css`, and `board-enhanced.css`.
  - JavaScript: Implements the interactive features of the whiteboard, including drawing tools, real-time communication, and user interface updates, as seen in `board.js` and `script.js`.
  - Socket.IO: Enables real-time communication between the client and server, allowing for instant updates across all connected clients.
- Backend:
  - Node.js: Provides the runtime environment for the server-side code.
  - Express: A web framework for Node.js that simplifies the creation of API endpoints and server-side logic, as defined in `server.js`.
  - MongoDB: A NoSQL database used to store whiteboard data and user information. The connection string is defined in the `.env` file and the database models are defined in the `models/` directory.
  - JWT: Used for user authentication and authorization, ensuring that only authorized users can access the whiteboard. The JWT_SECRET environment variable is used to sign and verify the tokens.

Chapter 5

H/w and S/w Requirement

This chapter discusses the hardware and software requirements for the Whiteboard application. The chapter also includes details about the development environment and tools used.

5.1 Experimental Setup
The Whiteboard application was developed and tested on the following system configuration:

 Hardware Specification:
• Processor: Intel(R) Core(TM) i5-8250U CPU @ 1.60GHz, 1800 Mhz, 4 Core(s), 8 Logical Processor(s)
• RAM : 8GB

 Software Specification:
• Windows 10
• Node.js v16.13.0
• Visual Studio Code 1.63.2

5.2 Experimental Results
The application was tested with multiple concurrent users to evaluate its performance and scalability. The results indicate that the application can handle a large number of users with minimal latency.

5.3 Discussion
The experimental results demonstrate the effectiveness of the chosen technologies and the overall design of the application. The use of WebSockets for real-time communication and MongoDB for data persistence has proven to be a scalable and reliable solution.

Chapter 6

CONCLUSION AND FUTURE SCOPE

This chapter presents the conclusion of the Whiteboard project and discusses potential future enhancements.

6.1 Conclusion
The Whiteboard project successfully developed a collaborative online whiteboard application that allows multiple users to draw and interact in real-time. The application demonstrates the effectiveness of WebSockets in implementing real-time communication and provides a user-friendly interface for collaborative work.

6.2 Future Scope
Future enhancements to the Whiteboard application could include:

- Integration with video conferencing for enhanced collaboration
- Support for additional file formats and import/export features
- Implementation of user authentication and access control
- Development of mobile applications for iOS and Android

REFERENCES
Node.js Documentation. https://nodejs.org/en/docs/
Express.js Documentation. https://expressjs.com/
WebSocket API Documentation. https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
HTML5 Canvas Documentation. https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API
Socket.IO Documentation. https://socket.io/docs/v4/
React Documentation. https://reactjs.org/docs/getting-started.html
MongoDB Documentation. https://www.mongodb.com/docs/
Redis Documentation. https://redis.io/documentation
WebRTC Documentation. https://webrtc.org/
JWT Documentation. https://jwt.io/introduction
Axios Documentation. https://axios-http.com/docs/intro
Webpack Documentation. https://webpack.js.org/concepts/
Babel Documentation. https://babeljs.io/docs/
ESLint Documentation. https://eslint.org/docs/user-guide/
Jest Documentation. https://jestjs.io/docs/getting-started
Docker Documentation. https://docs.docker.com/
Kubernetes Documentation. https://kubernetes.io/docs/home/
Nginx Documentation. https://nginx.org/en/docs/
Postman Documentation. https://learning.postman.com/docs/
Git Documentation. https://git-scm.com/doc

WEBSITES VISITED
https://socket.io/
https://developer.mozilla.org/en-US/
https://www.w3schools.com/
https://www.freecodecamp.org/
https://stackoverflow.com/
https://github.com/
https://www.digitalocean.com/community/tutorials

ANNEXURE-A

Details of Projectees: -
Sr.No Photo Details
1

    Name-

[Student Name 1]

EmaIL ID-
[Student Email 1]
Contact No-
[Student Contact 1]
2 Name-
[Student Name 2]
EmaIL ID-
[Student Email 2]
Contact No-
[Student Contact 2]
3 Name-
[Student Name 3]
EmaIL ID-
[Student Email 3]
Contact No-
[Student Contact 3]
4 Name-
[Student Name 4]
EmaIL ID-
[Student Email 4]
Contact No-
[Student Contact 4]
