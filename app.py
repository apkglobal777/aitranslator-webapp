from flask import Flask, render_template, request
from transformers import MarianMTModel, MarianTokenizer
app = Flask(__name__)

#to select the model
model_name = "Helsinki-NLP/opus-mt-en-hi"
#to load the model
model = MarianMTModel.from_pretrained(model_name)
#to load the tokenizer
tokenizer = MarianTokenizer.from_pretrained(model_name)

def translation(data):
    #convert the text into token
    inputs = tokenizer(data, return_tensors="pt", padding=True)
    #translate the data using model
    translated = model.generate(**inputs)
    #decode the token into readable text
    result = tokenizer.decode(translated[0], skip_special_tokens=True)
    return result

@app.route('/', methods=['POST', 'GET'])
def index():
    translated_text = ""
    if request.method == 'POST':
        data = request.form['data']
        translated_text = translation(data)
    return render_template('index.html', translated_text=translated_text)

if __name__ == '__main__':
    app.run(debug=True)