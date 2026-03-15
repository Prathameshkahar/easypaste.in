function createPaste(){

let text = document.getElementById("paste").value;

let id = Math.random().toString(36).substring(2,8);

localStorage.setItem(id,text);

let link = window.location.origin + "/pastebin/paste.html?id=" + id;

document.getElementById("link").innerHTML =
"Share this link:<br><a href='"+link+"'>"+link+"</a>";

}
