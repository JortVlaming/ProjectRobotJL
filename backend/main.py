import qi

session = qi.Session()
session.connect("tcp://192.168.2.198:9559")

tts = session.service("ALTextToSpeech")
tts.setVolume(0.2)
tts.say("it works")