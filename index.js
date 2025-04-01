// Wrapping the whole extension in a JS function 
// (ensures all global variables set in this extension cannot be referenced outside its scope)
(async function(codioIDE, window) {
  
  // Refer to Anthropic's guide on system prompts here: https://docs.anthropic.com/claude/docs/system-prompts
  const systemPrompt = `
  You are a helpful teaching assistant. 
  Your task is to generate learning objectives for an assignment using the following template:

  <template>
    ### Learners will be able to...

    * ### Learning objectives
    * ### Go here
    * ### Should read like test question

    |||guidance
    ## Assumptions
    [What do we expect the students to already know]

    ## Limitations
    [What might not be covered, or design decisions made by Codio, ending with a new line character]

    |||

    </template>
    Note:
    - Make sure to use the format as a template for the learning objectives you generate.
    - Make sure there is a new line before the last ||| of the guidance tag.
    - Make sure all the bullet points start with a ### for bold markdown formatting as per the template provided.
    - Do not stray away from the template and respond with the learning objectives page inside the <learning_objectives> tag. 
    `
  
  // register(id: unique button id, name: name of button visible in Coach, function: function to call when button is clicked) 
  codioIDE.coachBot.register("generateLearningObjectivesButton", "Please generate the Learning Objectives", onButtonPress)
  
  // function called when I have a question button is pressed
  async function onButtonPress() {

    // get guides structure for page names and order
    let guidesStructure
    try {
        guidesStructure = await window.codioIDE.guides.structure.getStructure()
        console.log("This is the Guides structure", guidesStructure)
    } catch (e) {
        console.error(e)
    }

    // filter out everything else and onlt keep guide elements of type: page
    const findPagesFilter = (obj) => {
        if (!obj || typeof obj !== 'object') return [];
        return [
            ...(obj.type === 'page' ? [obj] : []),
            ...Object.values(obj).flatMap(findPagesFilter)
        ];
    };

    const assignmentPages = findPagesFilter(guidesStructure)
    console.log("pages", assignmentPages)

    let guidePages = {}

    // iterate through page ids of pages and fetch all page data
    for ( const element_index in assignmentPages) {
      
        let pageTitle = assignmentPages[element_index].title

        const excludedKeywords = [
        "learning objectives", "learning_objectives", "LearningObjectives", "Learning_Objectives", "learning-objectives",
        "Learning-Objectives", "LearningObjectives---", "Objectives_Learning", "Objectives-Learning", "learningobjectives",
        "LO_", "LO-", "Learning_Obj", "LearningObj", "Objectives", "LOs"
        ]

        if (excludedKeywords.some(keyword => pageTitle.includes(keyword))) {
            continue
        }
        // console.log("element", element)
        let page_id = assignmentPages[element_index].id
        // console.log("page id", page_id)
        let pageData = await codioIDE.guides.structure.get(page_id)
        // console.log("pageData", pageData)
        guidePages[element_index] = {"title": pageTitle, "id": page_id, "content": pageData.settings.content};
    }
   
    console.log("guide pages", guidePages)

    // Concatenate all pages for LLM context
    let concatenatedPages = ""
    for (const [pageIndex, pageData] of Object.entries(guidePages)) {
        concatenatedPages += pageData.content;
    }
    console.log(concatenatedPages);
    
    const userPrompt = `
    Here is the assignment content. Read it carefully and generate the learning objectives page:
    
    <assignment_content>
    {{CONTENT}}
    </assignment_content>

    Note:
    - Keep the bullet points to 1-5 learning objectives that cover all the pages in the assignment content.
    - Make sure all the bullet points start with a ### for markdown formatting as per the template provided.
    `

    codioIDE.coachBot.write(`Generating Learning Objectives ... please wait...`)
    var updatedUserPrompt = userPrompt.replace('{{CONTENT}}', concatenatedPages)


    async function fetchLLMResponseXMLTagContents(userPrompt, xml_tag) {

        // Send the API request to the LLM with page content
        const result = await codioIDE.coachBot.ask(
            {
                systemPrompt: systemPrompt,
                messages: [{
                    "role": "user", 
                    "content": userPrompt
                }]
            }, {stream:false, preventMenu: true}
        )
        console.log("response", result.result)

        const startIndex = result.result.indexOf(`<${xml_tag}>`) + `<${xml_tag}>`.length
        const endIndex = result.result.lastIndexOf(`</${xml_tag}>`);

        // // console.log("start index", startIndex)
        // // console.log("endIndex", endIndex)

        return result.result.substring(startIndex, endIndex);
        // return result.result
    }
        
    const generatedContent = await fetchLLMResponseXMLTagContents(updatedUserPrompt, "learning_objectives")
    console.log("Generated Learning Objective result", generatedContent)

    let learning_objectives
    try {
      learning_objectives = await window.codioIDE.guides.structure.add({
          title: 'Learning Objectives', 
          type: window.codioIDE.guides.structure.ITEM_TYPES.PAGE,
          content: `${generatedContent}`,
          layout: window.codioIDE.guides.structure.LAYOUT.L_1_PANEL,
          closeAllTabs: true,
          showFileTree: false
      }, null, 0)
      console.log('Learning Objectives added ->', learning_objectives) 
    } catch (e) {
      console.error(e)
    }

    codioIDE.coachBot.write(`Learning Objectives page generated successfully!`)
    codioIDE.coachBot.showMenu()
    
  }
// calling the function immediately by passing the required variables
})(window.codioIDE, window)