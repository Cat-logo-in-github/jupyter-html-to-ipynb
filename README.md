# Jupyter HTML → IPYNB

 ### Recover a Jupyter notebook from a JupyterLab HTML export — entirely in your browser.

 A small, privacy-friendly tool for the surprisingly annoying problem of turning a Jupyter/JupyterLab `.html` export back into a real `.ipynb` notebook.

 ## Why does this exist?

 A few years ago, I had a Jupyter notebook that I needed to preserve, so I exported it to HTML.

 At the time, that seemed like a perfectly reasonable thing to do.

 Fast-forward to when I actually needed the notebook again: I had the HTML file, but not the original `.ipynb`.

 I tried several online HTML → IPYNB converters.

 Some couldn't recognize the JupyterLab structure. Others produced notebooks with broken cell boundaries, mangled Python code, lost indentation, missing Markdown, or incomplete outputs.

 The particularly frustrating part was that the HTML **contained most of the information needed to reconstruct the notebook**. The problem was extracting it correctly.

 So I ended up writing a custom recovery script.

 That script worked well enough for my particular JupyterLab export, and this project is essentially the browser-based version of that idea.

 If you've found this repository because you have an old Jupyter HTML export sitting around and the usual online converters aren't handling it properly, **hopefully this helps you too.**

---

 ## ✨ What it does

 The converter attempts to recover:

 - Original JupyterLab cell boundaries
- Python/code cell source
- Python indentation and spacing
- Markdown cells
- Cell execution counts
- Plain-text outputs
- Rendered HTML outputs
- Images embedded as base64 data URLs
- Notebook cell IDs
- A valid `.ipynb` notebook structure

 The resulting file is a normal **nbformat 4 Jupyter notebook**.

---

 ## 🔒 Your file stays on your computer

 This is intentionally a **client-side application**.

 Your HTML file is:

 1. Selected in your browser
2. Parsed locally using JavaScript
3. Converted locally
4. Downloaded directly back to your computer

 The HTML file is **not uploaded to a server**.

 That matters because notebooks can contain research data, code, paths, credentials accidentally included in outputs, or other private information.

---

 ## 🧠 Why not just use an existing converter?

 JupyterLab's HTML output isn't simply a webpage containing one big block of code.

 The exported HTML contains structures representing things such as:

```
Notebook
├── Cell
│   ├── Input
│   │   └── Syntax-highlighted code
│   └── Output
│       ├── Text
│       ├── HTML
│       └── Images
├── Markdown Cell
└── ...
```

 One particularly important detail is the syntax-highlighted code.

 A naive HTML parser might extract text from every `<span>` and insert newlines between them. That can turn perfectly valid code like:

```
alevinQCReport(
    samples,
    output_dir=results
)
```

 into something completely unusable.

 This converter instead extracts the underlying `<pre>` text and concatenates the syntax-highlighted elements without inventing whitespace.

 That distinction is a big part of why this exists.

---

 ## 🚀 Usage

 Open the website and either:

 - Drag a JupyterLab `.html` file onto the drop zone, or
- Click **Choose HTML File**

 The converter will analyze the notebook and show a small recovery report.

 For example:

```
Conversion complete

42 Cells
31 Code
11 Markdown
18 Outputs
7 Images
```

 Then click:

 **Download .ipynb**

 Your recovered notebook will be saved with a name similar to:

```
my_notebook_RECOVERED.ipynb
```

---

 ## ⚠️ Important limitations

 This is a **recovery tool**, not a magical reversal of HTML export.

 HTML is a rendered representation of a notebook, so some original notebook metadata may no longer exist in the HTML.

 Depending on the JupyterLab version and the way the HTML was generated, some things may not be recoverable perfectly.

 In particular:

 - Notebook-level metadata may be incomplete.
- Some rich MIME outputs may not be reconstructable.
- Complex interactive widgets may not survive.
- External resources that weren't embedded in the HTML cannot be recovered.
- Markdown is reconstructed from rendered HTML, so unusual Markdown syntax may change.
- The converter is primarily designed around **JupyterLab HTML exports**.

 If something doesn't work, an issue containing a **small anonymized HTML example** is much more useful than simply saying "it doesn't work."

---

 ## 🧪 Testing

 After conversion, it's a good idea to open the resulting `.ipynb` in:

 - JupyterLab
- Jupyter Notebook
- Google Colab
- VS Code with the Jupyter extension

 Check especially:

 - Python indentation
- Cell boundaries
- Markdown formatting
- Images
- Outputs
- Execution counts

 The converter also prints detailed diagnostic information to the browser console, including recovered cell types, character counts, and line counts.

---

 ## 🛠️ Running locally

 There is no build system or backend.

 Clone the repository:

```
git clone https://github.com/YOUR-USERNAME/jupyter-html-to-ipynb.git
cd jupyter-html-to-ipynb
```

 Then open:

```
index.html
```

 in a browser.

 That's it.

 The project is deliberately simple because there isn't really a reason for a backend here.

---

 ## 🌐 GitHub Pages

 The project is designed to run directly on GitHub Pages.

 To deploy your own copy:

 1. Fork or clone this repository.
2. Push it to GitHub.
3. Open **Settings → Pages**.
4. Select **Deploy from a branch**.
5. Select the `main` branch and `/ (root)`.
6. Save.

 GitHub will provide a public URL for your copy of the converter.

---

 ## 🤝 Why I made this public

 I originally made this because **I had the problem**.

 I had an old HTML export that I couldn't reasonably turn back into the notebook I needed, and the existing tools I tried weren't handling that particular JupyterLab HTML structure correctly.

 It felt like one of those small, oddly specific problems that probably isn't worth building a huge service around — but might be extremely useful to the next person who encounters exactly the same problem.

 So here it is.

 If this saves you from having to recreate a notebook from an HTML file by hand, then it has done its job.

---

 ## 📜 License

 MIT License.

 Use it, modify it, fork it, host your own copy, or improve the recovery logic for other JupyterLab HTML formats.

 If you make the converter better, please consider contributing the improvements back so the next person with a five-year-old HTML notebook doesn't have to go through the same headache.

---

 **Made for the unfortunate moment when you realize your "backup" is an HTML file.**
