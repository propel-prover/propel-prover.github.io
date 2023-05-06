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
            else if (t=='lambda' || t=='cases' || t=='let' || t=='letrec' || t=='lettype' || t=='if' || t=='not'
                  || t=='or' || t=='and' || t=='implies' || t=='def' || t=='type') {
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
    const prefix = code.substring(0, index);

    const context = prefix.match(/[\[\]{}()][^\[\]{}()\r\n]*$/);
    if (!context) return false;

    const elem = document.querySelector("#index" + (index-context[0].length));
    if (elem == null) return false;

    filterItemsPopup(prefix, context[0]);

    copyDescriptionPopup();

    let editor = document.querySelector("#editor");
    let editorRect = editor.getBoundingClientRect();
    let elemRect = elem.getBoundingClientRect();

    elemRect = DOMRect.fromRect({
        x: Math.max(Math.min(elemRect.x, document.documentElement.clientWidth - 550), 50),
        y: elemRect.y,
        width: elemRect.width,
        height: elemRect.height
    })

    if (elemRect.left < editorRect.left - 2 || elemRect.left > editorRect.left + editor.clientWidth + 2 ||
        elemRect.bottom < editorRect.top - 2 || elemRect.bottom > editorRect.top + editor.clientHeight + 2)
        return false;

    const autocomplete = document.querySelector("#autocomplete");
    autocomplete.style.left = (elemRect.left+window.scrollX) + 'px';
    autocomplete.style.top = (elemRect.bottom+window.scrollY) + 'px';
    autocomplete.classList.add("active");

    return true;
}

function filterItemsPopup(prefix, context) {
    const token = context.match(/[^\s]*$/)[0];
    const inSquareBrackets = context[0] == '[';

    const DEFAULT = 0;
    const IN_DOUBLE_QUOTE_STRING = 1;
    const IN_DOUBLE_QUOTE_STRING_ESC = 2;
    const IN_SINGLE_QUOTE_STRING = 3;
    const IN_SINGLE_QUOTE_STRING_ESC = 4;
    const IN_COMMENT = 5;

    var state = DEFAULT;
    var parens = 0;

    for (let i = 0; i < prefix.length - token.length; i++) {
        switch (state) {
        case IN_DOUBLE_QUOTE_STRING_ESC: state = IN_DOUBLE_QUOTE_STRING; break;
        case IN_SINGLE_QUOTE_STRING_ESC: state = IN_SINGLE_QUOTE_STRING; break;
        case IN_DOUBLE_QUOTE_STRING: if (prefix[i] == '\"') state = DEFAULT; break;
        case IN_SINGLE_QUOTE_STRING: if (prefix[i] == '\'') state = DEFAULT; break;
        case IN_COMMENT: if (prefix[i] == '\r' || prefix[i] == '\n') state = DEFAULT; break;
        default:
            switch (prefix[i]) {
            case ';': state = IN_COMMENT; break;
            case '\"': state = IN_DOUBLE_QUOTE_STRING; break;
            case '\'': state = IN_SINGLE_QUOTE_STRING; break;
            case '(': case '[': case '{': parens++; break;
            case ')': case ']': case '}': parens--; break;
            }
        }
    }

    const nested = parens > 0;

    let applicableItems = false;

    function filterItems(id, predicate) {
        let applicable = false;

        document.querySelectorAll(`#${id} + ul > li > code`).forEach(element => {
            if (predicate(element.textContent)) {
                element.parentElement.classList.remove("inapplicable");
                element.parentElement.dataset.completion =
                    element.textContent[0] == token[0]
                        ? element.textContent.substring(token.length)
                        : element.textContent.substring(token.length - 1);
                applicable = true;
                applicableItems = true;
            } else {
                element.parentElement.classList.add("inapplicable");
                element.parentElement.classList.remove("selected");
                delete element.parentElement.dataset.completion;
            }
        });

        if (applicable)
            document.getElementById(id).classList.remove("inapplicable");
        else
            document.getElementById(id).classList.add("inapplicable");
    }

    filterItems("syntax-definitions", text => text.startsWith(token) && !nested);
    filterItems("syntax-expressions", text => text.startsWith(token));
    filterItems("syntax-patterns", text => text.startsWith(token) && nested);
    filterItems("syntax-types", text => text.startsWith(token) && nested);
    filterItems("syntax-properties", text => (text.startsWith(token) || ("[" + text).startsWith(token)) && inSquareBrackets);

    if (applicableItems)
        document.getElementById("autocomplete").classList.remove("inapplicable");
    else
        document.getElementById("autocomplete").classList.add("inapplicable");

    if (!document.querySelector("#autocomplete li.selected")) {
        const firstItem = document.querySelector("#autocomplete li:not(.inapplicable)") || document.querySelector("#autocomplete li");
        firstItem.classList.add("selected");
    }
}

function copyDescriptionPopup() {
    document.querySelector("#autocomplete #selected-description").innerHTML =
        document.querySelector("#autocomplete li.selected .description").innerHTML;
}

function selectedIndexPopup() {
    const items = Array.from(document.querySelectorAll("#autocomplete li:not(.inapplicable)"));
    var index = 0;
    for(; index<items.length; index++)
        if (items[index].classList.contains("selected"))
            break;
    return index;
}

function highlightOptionOffsetPopup(offsetIndex) {
    const N = document.querySelectorAll("#autocomplete li:not(.inapplicable)").length;
    const index = selectedIndexPopup();
    const newIndex = (N + index + offsetIndex) % N;
    highlightOptionPopup(newIndex, true);
}

function highlightOptionPopup(index, scroll) {
    document.querySelector("#autocomplete li.selected").classList.remove("selected");

    const items = document.querySelectorAll("#autocomplete li:not(.inapplicable)");
    items[index].classList.add("selected");

    copyDescriptionPopup();

    if (scroll) {
        if (index == 0)
            document.querySelector("#syntax").scrollTop = 0;
        else
            items[index].scrollIntoView({ block: "nearest", inline: "nearest" });
    }
}

function insertSelectionPopup() {
    const editor = document.querySelector("#editor");
    const selected = document.querySelector("#autocomplete li.selected");
    const completion = selected.dataset.completion || "";
    const selection = completion.match(/^([^< ]* *)(<[^>]+>|\[<[^>]+>\])/);
    const selectionRange = selection ? [editor.selectionStart + selection[1].length, editor.selectionStart + selection[0].length] : [];
    editor.focus();
    document.execCommand("insertText", false, completion);
    if (selectionRange.length)
        editor.setSelectionRange(selectionRange[0], selectionRange[1])
    closePopup();
}

function closePopup() {
    const autocomplete = document.getElementById("autocomplete");
    autocomplete.classList.remove("active");
    autocomplete.style.left = "50px";
}

function isOpenPopup() {
    return document.querySelector("#autocomplete").classList.contains("active");
}


function initEditor() {
    const editor = document.querySelector("#editor");
    const viewer = document.querySelector("#viewer");
    const autocomplete = document.querySelector("#autocomplete");

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
        if (e.keyCode == 9) { // TAB
            if (e.shiftKey) {
                const caret = Math.min(editor.selectionStart, editor.selectionEnd);
                const selection = editor.value.substring(0, caret).match(/(<[^>]+>|\[<[^>]+>\])( *)$/);
                if (selection)
                    editor.setSelectionRange(caret - selection[0].length, caret - selection[2].length);
            } else {
                const caret = Math.max(editor.selectionStart, editor.selectionEnd);
                const lineWhitespaces = ("\n" + editor.value.substring(0, caret)).match(/\r?\n( *)[^\r\n]*\r?\n( *)$/);
                const diffWhitespaces = lineWhitespaces ? lineWhitespaces[1].length - lineWhitespaces[2].length : 0;
                const selection = !diffWhitespaces ? editor.value.substring(caret).match(/^( *)(<[^>]+>|\[<[^>]+>\])/) : null;
                if (selection)
                    editor.setSelectionRange(caret + selection[1].length, caret + selection[0].length);
                else if (editor.selectionStart == editor.selectionEnd)
                    document.execCommand("insertText", false, " ".repeat(diffWhitespaces > 0 ? diffWhitespaces : 2));
            }
            e.preventDefault();
        }
        else if (e.keyCode == 27) { // ESC
            closePopup();
            e.preventDefault();
        } else if (isOpenPopup()) {
            if (e.keyCode == 38 || e.keyCode == 40) { // UP or DOWN
                lastKeyDownEventDate = Date.now();
                highlightOptionOffsetPopup(e.keyCode - 39); // -1 on UP, 1 on DOWN
                e.preventDefault();
            } else if (e.keyCode == 13) { // ENTER
                insertSelectionPopup();
                e.preventDefault();
            } else if (e.keyCode == 37 || e.keyCode == 39) { // LEFT or RIGHT
              closePopup();
            }
        } else if (e.keyCode == 32 && e.ctrlKey) { // SPACE
            if (editor.selectionStart == editor.selectionEnd)
                openPopup(editor.value, editor.selectionStart);
            e.preventDefault();
        }
    }

    function loadExample() {
        const exampleId = document.querySelector("#example").value;
        editor.value = document.getElementById(exampleId).innerHTML.trim();
        content();
    }

    loadExample();

    editor.addEventListener('keydown', popupKeyDownEventListener);
    autocomplete.addEventListener('keydown', popupKeyDownEventListener);

    editor.addEventListener('scroll', scroll);

    editor.addEventListener('input', function() {
        if (editor.selectionStart == editor.selectionEnd) {
            const ch = editor.value[editor.selectionStart - 1]
            if (ch.match(/\s/)) {
                closePopup();
            }
            else if (ch == '(' || ch == '{' || ch == '[' || isOpenPopup()) {
                if (!openPopup(editor.value, editor.selectionStart))
                    closePopup();
            }
        }
    });

    function checkCaret() {
        if (editor.selectionStart == editor.selectionEnd) {
            highlightParen(editor.value, editor.selectionStart, '#D8D8D8');
        }
    }

    editor.addEventListener('keyup', checkCaret);
    editor.addEventListener('keypress', checkCaret);
    editor.addEventListener('mousedown', checkCaret);
    editor.addEventListener('mousemove', checkCaret);
    editor.addEventListener('mouseup', checkCaret);
    editor.addEventListener('touchstart', checkCaret);
    editor.addEventListener('touchmove', checkCaret);
    editor.addEventListener('touchend', checkCaret);
    editor.addEventListener('input', checkCaret);
    editor.addEventListener('paste', checkCaret);
    editor.addEventListener('cut', checkCaret);
    editor.addEventListener('select', checkCaret);
    editor.addEventListener('selectstart', checkCaret);
    editor.addEventListener('selectionchange', checkCaret);

    document.querySelectorAll("#autocomplete li").forEach(function (elem) {
        elem.addEventListener('mouseover', function() {
            // do not rehighlight if after up/down keypress a new <li> triggers its mouseover
            if (Date.now() - lastKeyDownEventDate > 500) {
                const index = Array.from(document.querySelectorAll("#autocomplete li:not(.inapplicable)")).indexOf(elem);
                if (index != -1)
                    highlightOptionPopup(index, false);
            }
        });
        elem.addEventListener('click', insertSelectionPopup);
    });

    editor.addEventListener('scroll', function () {
        if (isOpenPopup() && !openPopup(editor.value, editor.selectionStart))
            closePopup();
    });

    editor.addEventListener('mousedown', closePopup);
    editor.addEventListener('mouseup', closePopup);
    editor.addEventListener('touchstart', closePopup);
    editor.addEventListener('touchend', closePopup);
    editor.addEventListener('paste', closePopup);
    editor.addEventListener('cut', closePopup);

    document.addEventListener('click', function(e) {
        if (!autocomplete.contains(e.target) && !editor.contains(e.target))
            closePopup();
    });

    window.addEventListener('resize', closePopup);

    document.querySelector("#example").addEventListener('change', loadExample);
}



function initCompiler() {

    const workerCode = `data:,
    importScripts('${window.location.origin}/propel.min.js');

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

            statusElem.innerHTML = "<strong>Compiling</strong>";
            consoleElem.innerHTML = "&nbsp;<div style='scroll-snap-align: end'>&nbsp;</div>";
            consoleElem.style.scrollSnapType = "y mandatory";
            var output = consoleElem.firstChild;
            output.textContent = "";

            if (worker != null) worker.terminate();

            var worker = new Worker(workerCode);
            worker.postMessage([ editorElem.value,
                                 document.querySelector("#printDeduction").checked,
                                 document.querySelector("#printReduction").checked ]);
            worker.onmessage = function(e) {
                requestAnimationFrame(function() {
                    if (e.data.done) {
                        statusElem.innerHTML = "<strong>Result</strong> (" + Math.round(e.data.time*100)/100 + "ms) " + getLastLine(output.textContent);
                        consoleElem.lastChild.remove();
                        consoleElem.style.scrollSnapType = "";
                        consoleElem.scrollTop = consoleElem.scrollHeight;
                        worker = null;
                    } else {
                        output.textContent += e.data.line;
                    }
                })
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
