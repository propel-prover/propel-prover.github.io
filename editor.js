function syntaxHighlight(code) {
    if (code[code.length-1] == '\n') code += ' ';

    let output = "";
    let token = "";

    const START = 0;
    const IN_DOUBLE_QUOTE_STRING = 1;
    const IN_DOUBLE_QUOTE_STRING_ESC = 2;
    const IN_SINGLE_QUOTE_STRING = 3;
    const IN_SINGLE_QUOTE_STRING_ESC = 4;
    const IN_COMMENT = 5;
    const IN_ID = 6;

    let state = START;

    function emitTokenAndBackToStart(index) {
        let color = null;
        let weight = null;

        const t = token;

        switch (state) {
        case IN_SINGLE_QUOTE_STRING:
        case IN_DOUBLE_QUOTE_STRING:
            color = '#008700';
            break;
        case IN_COMMENT:
            color = '#878787';
            break;
        case IN_ID:
            // types
            if (t=='fun' || t=='forall' || t=='rec')
                color = '#0087af';
            // terms
            else if (t=='lambda' || t=='cases' || t=='let' || t=='letrec' || t=='if' || t=='not'
                  || t=='or' || t=='and' || t=='implies' || t=='type') {
                color = '#d75f00';
                weight = 'bold';
            }
            // props
            else if (t=='comm' || t=='assoc' || t=='idem' || t=='sel' || t=='refl' || t=='irefl'
                  || t=='sym' || t == 'antisym' || t=='asym' || t=='conn' || t=='trans') {
                color = '#d70087';
                weight = 'bold';
            }
            // constructors
            else if (t.charCodeAt(0) >= 65 && t.charCodeAt(0) <= 90) {
                color = '#8700af';
                if (t=='True' || t=='False') weight = 'bold';
            }
        case START:
            if (t=='\\')
                color = '#d70000';
            else if ("()[]{},".includes(t))
                color = '#888888';
            else if (t == '\n')
                output += '</code><code class=line>';
        }

        if (t != '\n') { // do not print new lines
            if (color === null) output += token;
            else output += `<span style='color:${color};font-weight:${weight || 'normal'}'${index == null ? "" : " id=index"+index}>${token}</span>`;
        }

        token = "";
        state = START;
    }

    for (let i=0; i<code.length; i++) {
        let c = code[i];
        if (c == '<') c = '&lt;'; else if (c == '>') c = '&gt;';

        switch (state) {
        case IN_DOUBLE_QUOTE_STRING:
            token += c;
            if (c ==  '\\')    state = IN_DOUBLE_QUOTE_STRING_ESC;
            else if (c == '"') emitTokenAndBackToStart();
            break;
        case IN_DOUBLE_QUOTE_STRING_ESC:
            token += c;
            state = IN_DOUBLE_QUOTE_STRING;
            break;
        case IN_SINGLE_QUOTE_STRING:
            token += c;
            if (c == '\\')     state = IN_SINGLE_QUOTE_STRING_ESC;
            else if (c == "'") emitTokenAndBackToStart();
            break;
        case IN_COMMENT:
            token += c;
            if (c == '\n') emitTokenAndBackToStart();
            break;
        case IN_ID:
            if (" \t\n()[]{},'\"\\;".includes(c)) {
                emitTokenAndBackToStart();
                i--; // go back because these characters are not part of terms, i.e. reconsider them
            } else token += c;
            break;
        case START:
            token += c;
            if (c == '"') state = IN_DOUBLE_QUOTE_STRING;
            else if (c == "'") state = IN_SINGLE_QUOTE_STRING;
            else if (c == ';') state = IN_COMMENT;
            else if (" \n\t()[]{},\\".includes(c)) emitTokenAndBackToStart(i);
            else state = IN_ID;
        }
    }

    emitTokenAndBackToStart();

    return "<code class=line>" + output + "</code>";
}


function highlightParen(code, index, color) {
    // elem and matchElem are the DOM elements previously highlighted
    if (this.matchElem != null) this.matchElem.style.background = 'transparent';
    if (this.elem != null) this.elem.style.background = 'transparent';

    const c = code[index];
    let match = null;
    let dir = 0;

    switch (c) {
    case '(': match = ')'; dir = 1; break;
    case ')': match = '('; dir = -1; break;
    case '[': match = ']'; dir = 1; break;
    case ']': match = '['; dir = -1; break;
    case '{': match = '}'; dir = 1; break;
    case '}': match = '{'; dir = -1; break;
    }

    if (match == null || dir == 0) return;

    var counts = 0;
    let found=index+dir;
    for (; found >= 0 && found < code.length; found += dir) {
        if (code[found] == c) counts++;
        if (code[found] == match) {
            if (counts == 0) break;
            counts--;
        }
    }

    this.matchElem = document.querySelector('#index' + found);
    if (this.matchElem != null) this.matchElem.style.background = color;

    this.elem = document.querySelector('#index' + index);
    if (this.elem != null) this.elem.style.background = color;
}


function openPopup(code, index) {
    // only open popup if the cursor is after (
    if (index == 0 || code[index-1] != '(') return false;

    const elem = document.querySelector("#index" + (index-1));
    if (elem == null) return false;

    copyDescriptionPopup();

    const box = elem.getBoundingClientRect();
    const autocomplete = document.querySelector("#autocomplete");
    autocomplete.style.visibility = 'visible';
    autocomplete.style.left = box.x + 'px';
    autocomplete.style.top = (box.y+20) + 'px';

    return true;
}

function copyDescriptionPopup() {
    document.querySelector("#autocomplete #selected-description").innerHTML =
        document.querySelector("#autocomplete .selected .description").innerHTML;
}

function selectedIndexPopup() {
    const lis = Array.from(document.querySelectorAll("#autocomplete li"));
    var index = 0;
    for(; index<lis.length; index++)
        if (lis[index].className == 'selected')
            break;
    return index;
}

function highlightOptionOffsetPopup(offsetIndex) {
    const N = document.querySelectorAll("#autocomplete li").length;
    const index = selectedIndexPopup();
    const newIndex = (N + index + offsetIndex) % N;
    highlightOptionPopup(newIndex, true);
}

function highlightOptionPopup(index, scroll) {
    const selected = selectedIndexPopup();
    const lis = document.querySelectorAll("#autocomplete li");
    lis[selected].className = '';
    lis[index].className = 'selected';
    copyDescriptionPopup();
    if (scroll) {
        const target = lis[index];
        const popup = document.querySelector("#syntax");
        if (target.offsetTop - target.offsetHeight < popup.scrollTop
         || target.offsetTop > popup.scrollTop + popup.offsetHeight)
            popup.scrollTop = target.offsetTop - target.offsetHeight - 50;
    }
}

function insertSelectionPopup() {
    const selected = document.querySelector("#autocomplete li.selected code");
    const code = selected.innerText;
    const text = code.startsWith("(") ? code.substr(1) : code + ")";
    const editor = document.querySelector("#editor");
    editor.value = editor.value.substr(0, editor.selectionStart) + text +
                   editor.value.substr(editor.selectionStart);
    editor.dispatchEvent(new Event('input'));
    closePopup();
}

function closePopup() {
    document.querySelector("#autocomplete").style.visibility = 'hidden';
}

function isOpenPopup() {
    return document.querySelector("#autocomplete").style.visibility == 'visible';
}


function initEditor() {
    const editor = document.querySelector("#editor");
    const viewer = document.querySelector("#viewer");

    let popupOpen = false;
    let lastKeyDownEventDate = 0;

    function scroll() {
        viewer.scrollTop = editor.scrollTop;
        viewer.scrollLeft = editor.scrollLeft;
    }

    function content() {
        viewer.innerHTML = syntaxHighlight(editor.value);
    }

    editor.addEventListener('input', function() {
        content();
        scroll();
    });

    function popupKeyDownEventListener(e) {
        if (e.keyCode == 27) { // ESC key pressed: close popup
            closePopup();
        } else if (isOpenPopup()) {
            if (e.keyCode == 38 || e.keyCode == 40) { // UP or DOWN
                lastKeyDownEventDate = performance.now();
                highlightOptionOffsetPopup(e.keyCode - 39); // -1 on UP, 1 on DOWN
                e.preventDefault();
            } else if (e.keyCode == 13) { // ENTER
                insertSelectionPopup();
                e.preventDefault();
            }
        }
    }

    function loadExample() {
        const exampleId = document.querySelector("#example").value;
        editor.value = document.getElementById(exampleId).innerHTML.trim();
        content();
    }

    loadExample();

    editor.addEventListener('keydown', popupKeyDownEventListener);
    document.querySelector("#autocomplete").addEventListener('keydown', popupKeyDownEventListener);

    editor.addEventListener('scroll', scroll);

    editor.addEventListener('selectionchange', function() {
        popupOpen = openPopup(editor.value, editor.selectionStart);
        if (!popupOpen) closePopup();
        if (editor.selectionStart == editor.selectionEnd) {
            highlightParen(editor.value, editor.selectionStart, '#D8D8D8');
        }
    });

    document.querySelectorAll("#autocomplete li").forEach(function (elem, index) {
        elem.addEventListener('mouseover', function() {
            // do not rehighlight if after up/down keypress a new <li> triggers its mouseover
            if (performance.now() - lastKeyDownEventDate > 100)
                highlightOptionPopup(index, false);
        });
        elem.addEventListener('click', insertSelectionPopup);
    });

    document.querySelector("#example").addEventListener('change', function() {
        loadExample();
    });
}



function initCompiler() {

    const workerCode = `data:,
    importScripts('${window.location.origin}' + '/propel.min.js');

    console.log = function() {
        postMessage({ done: false, line: Array.from(arguments).join(" ") + "\\n" });
    };

    onmessage = function (e) {
        const t0 = performance.now();
        parseAndCheckSourceCode(e.data[0], e.data[1], e.data[2]);
        const t1 = performance.now();
        postMessage({ done: true, time: t1-t0 });
    };
    `;

    var worker = null;

    const editorElem = document.querySelector("#editor");
    const consoleElem = document.querySelector("#console");
    const statusElem = document.querySelector("#status");
    let timer = undefined;


    function getLastLine(str) {
        var line = "";
        var i = str.length-1;
        while (str.charAt(i) == '\n' && i >= 0) i--;
        while (i >= 0 && str.charAt(i) != '\n') {
            line = str.charAt(i) + line;
            i--;
        }
        return line;
    }

    function setCodeTimeoutCompiler(timeout) {
        timer = setTimeout(function() {

            statusElem.innerHTML = "Compiling...";
            consoleElem.innerHTML = "";

            if (worker != null) worker.terminate();

            var worker = new Worker(workerCode);
            worker.postMessage([ editorElem.value,
                                 document.querySelector("#printDeduction").checked,
                                 document.querySelector("#printReduction").checked ]);
            worker.onmessage = function(e) {
                if (e.data.done) {
                    statusElem.innerHTML = "Result: (" + e.data.time + "ms) " + getLastLine(consoleElem.innerHTML);
                    worker = null;
                } else {
                    consoleElem.innerHTML += e.data.line;
                }
                consoleElem.scrollTop = consoleElem.scrollHeight;
            }

        }, timeout);
    }

    editorElem.addEventListener('input', function() {
        if (document.querySelector("#checkOnInput").checked) {
            clearTimeout(timer);
            setCodeTimeoutCompiler(500);
        }
    });

    document.querySelector("#checkCode").addEventListener("click", function() {
        clearTimeout(timer);
        setCodeTimeoutCompiler(0);
    });
}

initEditor();
initCompiler();
