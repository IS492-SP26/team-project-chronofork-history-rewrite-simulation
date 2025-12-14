import sys
import panel as pn
import global_vars
from pages.config_page.config_page import ConfigPage

pn.extension()

css = """
#input{
  font-size: 120%;
}
"""
pn.extension(raw_css=[css])

# 创建 Panel 服务器
def init_web_page():
    config = ConfigPage()
    global_vars.app_layout[:] = [config]
    global_vars.app.main.append(global_vars.app_layout)
    global_vars.app.modal.append(global_vars.modal_content)

init_web_page()
global_vars.app.servable()