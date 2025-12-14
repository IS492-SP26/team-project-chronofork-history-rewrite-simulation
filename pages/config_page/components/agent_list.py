import asyncio
import json
import re
from autogen_agentchat.messages import TextMessage
from autogen_core import CancellationToken
import panel as pn
import param

import global_vars

class AgentList(pn.viewable.Viewer):
    agents = param.List(doc="A list of agents.")
    task_name =param.String(doc="Name of task")
    task_req = param.String(doc="Requirements of task")

    def __init__(self, **params):
        super().__init__(**params)
        self._layout = pn.Column(
            pn.pane.GIF('https://upload.wikimedia.org/wikipedia/commons/b/b1/Loading_icon.gif', sizing_mode='stretch_width'),
            "Recommending Specialized Agent for your Task..."
            )
        
        asyncio.create_task(self.generate_agent_list())

    async def generate_agent_list(self):
        with open('pages/config_page/config.txt', 'r', encoding='utf-8') as f:
            text = f.read()
        try:
            json_data = json.loads(text)
            self.agents=json_data.get("agent_list")
        except json.JSONDecodeError as e:
            self._layout.clear()
            
        
        await asyncio.sleep(2)
        self.update_agents_list()


    def update_agents_list(self):
        self._layout.clear()
        for idx, agent in enumerate(self.agents):
            agent_info = f'## {agent["avatar"]} {agent["name"]}\n'
            agent_info += agent["system_message"] + "\n\n---\n\n"
            update_button = pn.widgets.Button(name="Manage")
            update_button.on_click(lambda event, idx=idx: self.open_update_popup(idx))
            agent_panel = pn.Row(pn.pane.Markdown(agent_info,width=290), update_button)
            self._layout.append(agent_panel)
        
        add_agent_button = pn.widgets.Button(name='Add Agent')
        add_agent_button.on_click(self.open_add_popup)
        self._layout.append(add_agent_button)
        
    def open_update_popup(self, idx):

        def confirm_update(event):
            self.agents[idx] = {
                "name": name_input.value,
                "avatar": avatar_input.value,
                "system_message": system_message_input.value
            }
            self.update_agents_list()
            global_vars.app.close_modal()

        agent = self.agents[idx]
        name_input = pn.widgets.TextInput(name="Name", value=agent["name"])
        avatar_input = pn.widgets.TextInput(name="Avatar", value=agent["avatar"])
        system_message_input = pn.widgets.TextAreaInput(name="System Message", value=agent["system_message"])
        confirm_button = pn.widgets.Button(name="Confirm Update", button_type='primary')
        delete_button = pn.widgets.Button(name="Delete", button_type='danger', width=80)
        delete_button.on_click(lambda event, idx=idx: self.delete_agent(idx))
        
        confirm_button.on_click(confirm_update)
        popup_content = pn.Row(name_input, avatar_input, system_message_input)
        buttons = pn.Row(confirm_button, delete_button)
        global_vars.modal_content[:] = [popup_content,buttons]
        global_vars.app.open_modal()

    def get_agents(self):
        return self.agents
        
    def open_add_popup(self, event):
        name_input = pn.widgets.TextInput(name="Name", value="")
        avatar_input = pn.widgets.TextInput(name="Avatar", value="")
        system_message_input = pn.widgets.TextAreaInput(name="System Message", value="")
        confirm_button = pn.widgets.Button(name="Confirm Add", button_type='primary')
        
        def confirm_add(event):
            self.agents.append({
                "name": name_input.value,
                "avatar": avatar_input.value,
                "system_message": system_message_input.value
            })
            self.update_agents_list()
            global_vars.app.close_modal()
        
        confirm_button.on_click(confirm_add)
        popup_content = pn.Column(name_input, avatar_input, system_message_input, confirm_button)
        popup_content = pn.Row(name_input, avatar_input, system_message_input)
        global_vars.modal_content[:] = [popup_content,confirm_button]
        global_vars.app.open_modal()

    def add_agent(self, event):
        self.update_agents_list()

    def delete_agent(self, idx):
        global_vars.app.close_modal()
        self.agents.pop(idx)
        self.update_agents_list()

    def __panel__(self):
        return self._layout