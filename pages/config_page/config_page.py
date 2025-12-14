import panel as pn

from panel.viewable import Viewer
import global_vars
from pages.config_page.components.agent_list import AgentList
from pages.config_page.components.step_list import StepList

pn.extension()

class ConfigPage(Viewer):

    def __init__(self, **params):
        super().__init__(**params)

        self.req_input = pn.widgets.TextAreaInput(
            auto_grow=True, 
            max_rows=50, 
            rows=20, 
            placeholder=f"Briefly describe what you’d like to plan?\n\n",
            sizing_mode='scale_width',)
        confirm_button = pn.widgets.Button(name='Confirm', button_type='primary')
        confirm_button.on_click(self.req_confirm)
        
        self.req_content = pn.Column(
            f"# What would you like to plan?",
            self.req_input,
            confirm_button
        )
        req_card = pn.Card(self.req_content, title='Planning Task', max_width=500)

        self.agent_list_content = pn.Column("## Please describe your task to see recommended agents")
        agent_card = pn.Card(self.agent_list_content, title='Your Planning Team', margin=(0, 20), max_width=500)

        self.step_list_content = pn.Column("## Please confirm your planning team to continue")
        step_card = pn.Card(self.step_list_content, title='Task Breakdown', max_width=500)

        self._layout = pn.Row(req_card, agent_card, step_card)

    def req_confirm(self, event):
        confirmed_req = f"## Information about the Planning Task\n{self.req_input.value}"
        self.req_content[:] = [confirmed_req]
        
        agent_list_content = AgentList(task_name=self.task_name,task_req=self.req_input.value)
        confirm_button = pn.widgets.Button(name='Confirm', button_type='primary')
        confirm_button.on_click(lambda event, agent_list_content=agent_list_content: self.agents_confirm(agent_list_content))
        
        manage_button = pn.widgets.Button(name='Manage')
        self.agent_list_content[:] = [agent_list_content, 
            pn.Row(confirm_button,manage_button)]
    
    def agents_confirm(self, agent_list_content):
        agent_list=agent_list_content.get_agents()
        confirmed_agents = f"## Recommended Agents for Your Task\n"
        for agent in agent_list:
            confirmed_agents += f'## {agent["avatar"]} {agent["name"]}\n'
            confirmed_agents += agent["system_message"] + "\n\n---\n\n"
        
        step_list_content = StepList(agents=agent_list,task_name=self.task_name,task_req=self.req_input.value)
        confirm_button = pn.widgets.Button(name='Confirm', button_type='primary')
        confirm_button.on_click(lambda event, step_list_content=step_list_content: self.steps_confirm(step_list_content))

        self.agent_list_content[:] = [confirmed_agents]
        self.step_list_content[:] = [step_list_content,confirm_button]

    
    def steps_confirm(self,step_list_content):
        
        global_vars.app_layout[:] = ["# Please use VR headset to collaborate with Agents! 🥳"]

    def __panel__(self):
        return self._layout

