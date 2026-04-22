Let's outline how we do git for this project.

The main branch is "develop". This represents the latest version of our code that works, and runs.

Whenever you want to work on a feature, like building an led, make a featuer branch, named somthing like "led_build". Then, work on that, pushing upstream as needed.

When we are ready to merge, we will be using the following commands to preserve histroy of git:
1. git checkout develop, to make sure you're on develop
2. git merge --no-ff <your branch name>. Then, give a good commit message

Keeping it simle.