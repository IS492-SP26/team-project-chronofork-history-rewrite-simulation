import json
import time
import param
import panel as pn

from panel.viewable import Viewer

import global_vars
from pages.execute_page.components.stt_engine import STTEngine

pn.extension()  # for notebook

class ChatInterface(Viewer):
    messages = param.List(doc="A list of messages.")
    agents = param.List(doc="A list of agents.")

    def chat_send(self,event):
        if self.send_button.icon == 'player-play':
            self.radio_group.disabled=False
            self.send_button.icon = 'send'
            self.send_button.button_type = 'primary'
            global_vars.execute_page.send_to_server("process/start_plan","{}")
        elif self.text_input.value=='':
            pass
        else:
            target_name=next((target_content['target'] for target_content in self.target_content_pair if self.radio_group.value == target_content['content']), None)
            if not target_name:
                print(f'Agent Not Found! Value: {self.radio_group.value}')
                target_name='ProcessManager'
            global_vars.execute_page.send_to_server("user/talk",json.dumps(
            {
                "content": self.text_input.value,
                "targetAgent": target_name
            },ensure_ascii=False, indent=4))
            self.add_message(self.text_input.value,"User",target_name)

        self.text_input.value=''
        self.radio_group.value='EMPTY'
        self.send_button.disabled=True
        if self.start_stop_button.button_type=='danger':
            self.stt_engine.start_stop_recognition()
        self.start_stop_button.disabled=True
    
    def on_radio_group_change(self,event):
        value = event.new
        if value=='EMPTY':
            self.text_input.disabled=True
            self.text_input.placeholder="Choose an agent to talk to"
            for option in self.target_content_pair:
                option['content'] = option['content'].replace(' [⏳]', '')
            self.radio_group.options = [option['content'] for option in self.target_content_pair]
        elif not value:
            return
        else:
            self.start_stop_button.disabled=False
            self.send_button.disabled=False
            self.text_input.disabled=False
            self.text_input.placeholder=f"What do you want to say to {value}?"
            for option in self.target_content_pair:
                if option['content'] == value:
                    self.target = option['target']
                    break


    def __init__(self, **params):
        super().__init__(**params)
        self.avatars= {agent["name"]: agent["avatar"] for agent in self.agents}
        self.avatars["User"] = "😉"
        self._markdown = pn.pane.Markdown(sizing_mode='stretch_both')

        self.text_input = pn.widgets.TextAreaInput(placeholder="请点击右侧黄色按钮开始交互",disabled=True,sizing_mode='stretch_both',resizable='width')
        self.send_button = pn.widgets.Button(button_type='warning', icon="player-play",icon_size="25px",sizing_mode='stretch_height',width=50)
        self.send_button.on_click(self.chat_send)
        self.start_stop_button = pn.widgets.Button( button_type='success', icon="microphone",icon_size="25px",sizing_mode='stretch_height',width=50,disabled=True)
        self.stt_engine = STTEngine(self.start_stop_button, self.text_input)
        self.start_stop_button.on_click(self.stt_engine.start_stop_recognition)

        self.target_content_pair = [
            {
                'target': agent['name'],
                'content': f"{agent['avatar']} {agent['name']}"
            }
            for agent in self.agents
        ]
        self.target = ''
        self.content = ''

        self.radio_group = pn.widgets.RadioButtonGroup(options=[option['content'] for option in self.target_content_pair], button_type='primary',button_style='outline',sizing_mode='stretch_width',height=30,disabled=True,value='EMPTY')
        self.radio_group.param.watch(self.on_radio_group_change, "value")

        
        input_texts = pn.Column(self.radio_group,self.text_input)
        input_buttons = pn.Column(self.send_button, self.start_stop_button)
        input_layout = pn.Row(input_texts,input_buttons)
        
        chat_card_content = pn.Column(
            self._markdown,
            sizing_mode='stretch_both',
            scroll=True
        )
        chat_card = pn.Card(chat_card_content, title='Chat With Agents',sizing_mode='stretch_both',)

        input_card = pn.Card(input_layout, collapsible=False,hide_header=True, margin=(10,0,0,0),sizing_mode='stretch_both',max_height=250)

        self._layout = pn.Column(chat_card,input_card)

    def __panel__(self):
        return self._layout
    
    def agent_req_answer(self,req_agent_name):
        for option in self.target_content_pair:
            if option['target'] == req_agent_name:
                option['content'] +=' [⏳]'
                break
        self.radio_group.options=[option['content'] for option in self.target_content_pair]


    def add_message(self, content, source_name, recipient_name):
        # 将新消息插入到 messages 列表的开头
        self.messages.insert(0, {'content': content, 'source_name': source_name, 'recipient_name': recipient_name})
        
        
        # 构造新消息的字符串内容
        new_message = f"## {self.avatars.get(source_name)} {source_name} → {self.avatars.get(recipient_name)} {recipient_name}\n"
        new_message += content + "\n\n---\n\n"
        
        # 将新消息放到原有内容之前
        self.content = new_message + self.content
        self._markdown.object = self.content
        return