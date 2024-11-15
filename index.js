// Wrapping the whole extension in a JS function 
// (ensures all global variables set in this extension cannot be referenced outside its scope)
(async function(codioIDE, window) {
  
  // Refer to Anthropic's guide on system prompts here: https://docs.anthropic.com/claude/docs/system-prompts
  const systemPrompt = "You are a helpful teaching assistant. Only respond with the formatted learning objectives."
  
  // register(id: unique button id, name: name of button visible in Coach, function: function to call when button is clicked) 
  codioIDE.coachBot.register("generateLearningObjectivesButton", "Please generate the Learning Objectives", onButtonPress)
  // function called when I have a question button is pressed
  async function onButtonPress() {
    // Function that automatically collects all available context 
    // get guides structure for page names and order
    let structure
    try {
        structure = await window.codioIDE.guides.structure.getStructure()
        console.log("This is the Guides structure", structure)
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

    const pages = findPagesFilter(structure)
    console.log("pages", pages)

    let guidePages = {}

    // iterate through page ids of pages and fetch all page data
    for ( const element_index in pages) {
      
      // console.log("element", element)
      let page_id = pages[element_index].id
      // console.log("page id", page_id)
      let pageData = await codioIDE.guides.structure.get(page_id)
      // console.log("pageData", pageData)
      guidePages[element_index] = {"title": pages[element_index].title, "id": page_id, "content": pageData.settings.content};
    }

    console.log("guide pages", guidePages)

    let single_page = ""

    for (const [pageIndex, pageData] of Object.entries(guidePages)) {
        single_page += pageData.content;
    }
    console.log(single_page);


    // the messages object that will contain the user prompt and/or any assistant responses to be sent to the LLM
    // Refer to Anthropic's guide on the messages API here: https://docs.anthropic.com/en/api/messages
    
    const userPrompt = `You are tasked with converting the contents of a single page from a Computer Science course into a learning objective for teachers. This learning objective should encapsulate the main concept or skill that students should acquire from the given content.

First, carefully read and analyze the following page content:

<page_content>
{{PAGE_CONTENT}}
</page_content>

Your task is to create a clear and concise learning objective based on this content. A good learning objective should:

1. Be specific and measurable
2. Focus on student performance
3. Use action verbs (e.g., define, explain, analyze, apply)
4. Align with the level of learning (e.g., knowledge, comprehension, application)

To complete this task:

1. Analyze the content and identify the key concept or skill being taught.
2. Determine the appropriate level of learning (e.g., remembering, understanding, applying, analyzing).
3. Choose a suitable action verb that reflects this level of learning.
4. Formulate a learning objective that clearly states what the student should be able to do after studying this content.

Use the following format to generate the learning objectives:
<learningObjectivesFormat>
### Learners will be able to...

* ### Learning objectives
* ### Go here
* ### Should read like test question

|||Guidance
## Assumptions
What do we expect the students to already know

## Limitations
What might not be covered, or design decisions made by Codio
|||
</learningObjectivesFormat>

Provide the learning objectives in the <learning_objectives> tag.
Ensure that your learning objective is directly related to the provided content and is appropriate for the course.`



    codioIDE.coachBot.write(`Generating Learning Objectives ... please wait...`)
    var updatedUserPrompt = userPrompt.replace('{{PAGE_CONTENT}}', single_page)


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

        
        
        const startIndex = result.result.indexOf(`<${xml_tag}>`) + `<${xml_tag}>`.length
        const endIndex = result.result.lastIndexOf(`</${xml_tag}>`);

        return result.result.substring(startIndex, endIndex);
    }

        
    const generatedContent = await fetchLLMResponseXMLTagContents(updatedUserPrompt, "learning_objectives")
    console.log("Generated Learning Objective result", generatedContent)

    let learning_objective
    try {
      learning_objective = await window.codioIDE.guides.structure.add({
          title: 'Learning Objective', 
          type: window.codioIDE.guides.structure.ITEM_TYPES.PAGE,
          content: `${generatedContent}`,
          layout: "L_1_PANEL",
          closeAllTabs: true,
          showFileTree: false

        
          
      })
      console.log('Learning Objective added ->', learning_objective) 
    } catch (e) {
      console.error(e)
    }

    codioIDE.coachBot.write(`Learning Objecives page generated successfully!`)


    codioIDE.coachBot.showMenu()


        


   
    
  }
// calling the function immediately by passing the required variables
})(window.codioIDE, window)

 
