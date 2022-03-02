function router(pushHistory=true) {
	console.log("Routing back..");
	let path = window.location.pathname; // look up at url bar
	let url = window.location.href;

	let magic = new RegExp(/\/chat\/\d+\?magic_key=/);
	let re = new RegExp(/\/chat\/\d+/);
	
	if (path == "/") {
		loadHeroPage(pushHistory);
	}
	else if (path == "/login") {
		loadLoginPage(pushHistory);
	}
	else if (magic.test(url)) {
		console.log("checking user...");
		checkUser();
	}
	else if (re.test(path)) {
		loadChatsPage(pushHistory);
	}
}

window.addEventListener("load", router);
window.addEventListener("popstate", (newState) => {console.log(newState); router(pushHistory=false)});

function loadLoginPage(pushHistory=true) {
	console.log("Loading login view");
	if (pushHistory) {
		history.pushState({}, "", "http://127.0.0.1:5000/login");
	}

	document.querySelector(".auth").setAttribute("style", "display: block");
	document.querySelector(".hero").setAttribute("style", "display: none");
	document.querySelector(".chat").setAttribute("style", "display: none");
}


function loadHeroPage(pushHistory=true) {
	console.log("Loading hero view");

	if (pushHistory) {
		history.pushState({}, "", "http://127.0.0.1:5000");
	}
	document.querySelector(".auth").setAttribute("style", "display: none");
	document.querySelector(".hero").setAttribute("style", "display: grid");
	document.querySelector(".chat").setAttribute("style", "display: none");
	loadChats();
}


function loadChatsPage(pushHistory=true) {
	console.log("Loading chat view");
	// chat_id should be coming from url
	let queryString = window.location.search;
	let urlParams = new URLSearchParams(queryString);
	let chat_id = urlParams.get('chat_id');
	let request = fetch("http://127.0.0.1:5000/get_magic_link",
						{method: 'POST',
						body: JSON.stringify({'chat_id': chat_id})});
	request.then((response) => response.json())
	.then(data => {
		let magic_link = data['magic_link'];
		document.querySelector(".auth").setAttribute("style", "display: none");
		document.querySelector(".hero").setAttribute("style", "display: none");
		document.querySelector(".chat").setAttribute("style", "display: block");
		
		// display invite link on page
		let invite_link = document.getElementById("invite link");
		invite_link.href = magic_link;
		invite_link.text = magic_link;
		startMessagePolling();
	});
}

function createUsername() {
	let new_username = document.querySelector("input#new_username").value;
	let new_password = document.querySelector("input#new_password").value;

	if (new_username && new_password) {
		let request = fetch("http://127.0.0.1:5000/create_user",
							{method: 'POST',
							 body: JSON.stringify({'username': new_username,
												   'password': new_password})});
		request.then((response) => response.json())
		.then(data => {
			if (data['success']) {
				let auth_key = data['auth_key'];
				// save auth_key to localStorage
				let localStorage = window.localStorage;
				localStorage.setItem("auth_key", auth_key);
				let magic_info = JSON.parse(localStorage.getItem('magic_info'));

				// if came through magic_link, load chat page
				if (magic_info) {
					// need to update db
					let chat_id = magic_info['chat_id'];
					let magic_key = magic_info['magic_key'];
					let request = fetch("http://127.0.0.1:5000/update_user",
										{method: 'POST',
										 body: JSON.stringify({'chat_id': chat_id,
										 					   'auth_key': auth_key})});
					request.then((response) => response.json())
					.then(data => {
						if (data['success']) {
							console.log("authorized user. go to chat page.");
							let new_url = "http://127.0.0.1:5000/chat/" + chat_id + "?chat_id=" + chat_id;
							history.pushState({}, "", new_url);
							loadChatsPage();
						}
					});
				}
				else {
					// else, load hero and push state
					loadHeroPage();
				}
			}
			else {
				console.log("Username is unavailable. Please enter a valid username and password.");
			}
		});
	}
}

function login() {
	let old_username = document.querySelector("input#old_username").value;
	let old_password = document.querySelector("input#old_password").value;

	if (old_username && old_password) {
		let request = fetch("http://127.0.0.1:5000/auth_user",
							{method: 'POST',
							 body: JSON.stringify({'username': old_username,
							 					   'password': old_password})});
		request.then((response) => response.json())
		.then(data => {
			if (data['success']) {
				let auth_key = data['auth_key'];
				// save auth_key to localStorage
				let localStorage = window.localStorage;
				localStorage.setItem("auth_key", auth_key);
				// load hero and push state
				loadHeroPage();
			}
			else {
				console.log("Please enter a valid username and password.");
			}
		});
	}
}


function checkUser() {
	let queryString = window.location.search;
	let urlParams = new URLSearchParams(queryString);
	let chat_id = urlParams.get('chat_id');
	let magic_key = urlParams.get('magic_key');

	let localStorage = window.localStorage;
	let auth_key = localStorage.getItem('auth_key');

	if (!auth_key) {
		console.log("unauthorized user. go to login page.");
		let magic_info = {'chat_id': chat_id, 'magic_key': magic_key};
		localStorage.setItem('magic_info', JSON.stringify(magic_info));
		loadLoginPage();
	}
	else {
		let request = fetch("http://127.0.0.1:5000/join",
							{method: 'POST',
							body: JSON.stringify({'auth_key': auth_key,
												'chat_id': chat_id,
												'magic_key': magic_key})});
		request.then((response) => response.json())
		.then(data => {
			if (!data['success']) {
				loadHeroPage();
			}
			else {
				console.log("authorized user. go to chat page.");
				let new_url = "http://127.0.0.1:5000/chat/" + chat_id + "?chat_id=" + chat_id;
				history.pushState({}, "", new_url);
				loadChatsPage();
			}
		});
	}
}


function loadChats() {
	let localStorage = window.localStorage;
	let auth_key = localStorage.getItem('auth_key');

	if (auth_key) {
		let request = fetch("http://127.0.0.1:5000/load_chats",
							{method: 'POST',
							body: JSON.stringify({'auth_key': auth_key})});
		request.then((response) => response.json())
		.then(data => {
			chats = data['chats'];
			let all_chats = document.querySelector("ul#chats");
			while (all_chats.firstChild) {
				all_chats.removeChild(all_chats.firstChild);
			}
			// add chats to page
			for (let chat of chats) {
				let chat_el = document.createElement("li");
				let chat_button = document.createElement("button");
				let text = document.createTextNode("Chat " + chat);
				
				function setCurrentChat() {
					let new_url = "http://127.0.0.1:5000/chat/" + chat + "?chat_id=" + chat;
					history.pushState({}, "", new_url);
					loadChatsPage();
				}
				let clickHandler = () => {setCurrentChat()};

				chat_button.addEventListener("click", clickHandler);
				chat_button.appendChild(text);
				chat_el.appendChild(chat_button);
		
				all_chats.appendChild(chat_el);
			  }
		});
	}
}


function createChat() {
	let localStorage = window.localStorage;
	let auth_key = localStorage.getItem('auth_key');
  
	let data = {'auth_key': auth_key};
  
	let request = fetch("http://127.0.0.1:5000/create_chat",
						{method: 'POST',
					     body: JSON.stringify(data)});
	request.then((response) => response.json())
	.then(data => {
		if (!data['success']) {
			console.log("You need a valid authorization key to create a new chat.");
			loadLoginPage();
		}
	  	else {
			let chat_id = data['chat_id'];
			let new_url = "http://127.0.0.1:5000/chat/" + chat_id + "?chat_id=" + chat_id;
			history.pushState({}, "", new_url);
			loadChatsPage();
	  }
	});
  }

  function postMessage() {
	let queryString = window.location.search;
	let urlParams = new URLSearchParams(queryString);
	let chat_id = urlParams.get('chat_id');
	// get auth_key from storage
	let auth_key = localStorage.getItem('auth_key');

	let text = document.querySelector("textarea").value;
  
	let request = fetch("http://127.0.0.1:5000/post_message",
						{method: 'POST',
						body: JSON.stringify({'chat_id': chat_id,
											  'auth_key': auth_key,
											  'text': text})});
	request.then((response) => response.json())
	.then(data => {
		if (data['success']) {
			console.log("Your message has been posted.");
	  	}
	  	else {
			console.log("You do not have access to post messages in this chat.");
	  	}
	});
  }

  function getMessages(chat_id) {
	let request = fetch("http://127.0.0.1:5000/get_messages",
						{method: 'POST',
						body: JSON.stringify({'chat_id': chat_id})});
	return request
  }
  
  
function startMessagePolling() {
	let queryString = window.location.search;
	let urlParams = new URLSearchParams(queryString);
	let chat_id = urlParams.get('chat_id');

	if (chat_id != null) {
		getMessages(chat_id).then((response) => response.json())
		.then(data => {
		  let messages = data["messages"];
	  
		  // first, remove all messages from html
		  let message_div = document.getElementsByClassName("messages")[0];
		  while (message_div.firstChild) {
			message_div.removeChild(message_div.firstChild);
		  }
		  // re-populate page with 'new' messages
		  for (let message of messages) {
			let m = document.createElement("message");
			let a = document.createElement("author");
			let c = document.createElement("content");
	  
			let author = document.createTextNode(message['author']);
			let text = document.createTextNode(message['text']);
			
			a.appendChild(author);
			c.appendChild(text);
	  
			m.appendChild(a);
			m.appendChild(c);
	  
			message_div.appendChild(m);
		  }
		})
		.then(() => {startMessagePolling()});
	}
}
