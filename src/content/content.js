
document.addEventListener("click", function(event) {
    const element = event.target;
    
    const locator = getBestLocator(element);
    
    const actionData = {
        action: "click",
        locator: locator,
        tag: element.tagName.toLowerCase(),
        text: element.innerText ? element.innerText.substring(0, 50).trim() : ""
    };

    console.log("QA-Pilot Recorded Action:", actionData);
    

}, true);

function getBestLocator(el) {
    if (el.getAttribute("data-testid")) return `[data-testid="${el.getAttribute("data-testid")}"]`;
    if (el.getAttribute("data-cy")) return `[data-cy="${el.getAttribute("data-cy")}"]`;
    
    if (el.id) return `#${el.id}`;
    
    if (el.getAttribute("name")) return `[name="${el.getAttribute("name")}"]`;
    
    if (el.getAttribute("aria-label")) return `[aria-label="${el.getAttribute("aria-label")}"]`;
    
    if (el.className && typeof el.className === "string") {
        const classes = el.className.trim().split(/\s+/).join('.');
        if (classes) return `.${classes}`;
    }
    
    return el.tagName.toLowerCase();
}