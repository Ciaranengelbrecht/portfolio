

"use client";
import React from "react";
import Image from "next/image";
import { TypeAnimation } from "react-type-animation";
import { motion } from "framer-motion";
import Link from "next/link";

const HeroSection = () => {
  return (
    <section className="lg:py-16">
      <div className="grid grid-cols-1 sm:grid-cols-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="col-span-8 place-self-center text-center sm:text-left justify-self-start"
        >
          <h1 className="text-white mb-4 text-4xl sm:text-5xl lg:text-8xl lg:leading-normal font-extrabold">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#868F96] to-[#596164]">
              Welcome. I'm{" "}
            </span>
            <br></br>
            <TypeAnimation
              sequence={[
                "Ciaran",
                1000,
                "a developer",
                1000,
                "an innovator",
                1000,
                "a software engineer.",
                1000,
              ]}
              wrapper="span"
              speed={50}
              repeat={Infinity}
            />
          </h1>
          <p className="text-[#ADB7BE] text-base sm:text-lg mb-6 lg:text-xl">
             This is my portfolio.
          </p>
          <div>
            <Link
              href="mailto:ciaran.engelbrecht@outlook.com"
              className="px-6 inline-block py-3 w-full sm:w-fit rounded-full mr-4 bg-gradient-to-br from-[#868F96] to-[#596164] hover:bg-slate-200 text-white"
            >
              Contact Me
            </Link>
            <Link
              href="https://s3.ap-southeast-2.amazonaws.com/ciaranengelbrecht.com/Resume%20Ciaran%20Engelbrecht%20for%20website.pdf?response-content-disposition=inline&X-Amz-Security-Token=IQoJb3JpZ2luX2VjEO%2F%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEaDmFwLXNvdXRoZWFzdC0yIkYwRAIgftq%2FUGq6ekqcHW8LyLhiJyY7l9CM2BKWPwavwus6%2BpwCIDUWPxSKD%2FSntX18ZkL0Vb%2Fu3w5M4BnnyB6tk2dGpycXKu0CCIj%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEQABoMMTc5MDk4NTM4MDU1IgyMgYwrYv4EHwBO1xMqwQK7h9jT9DmiqtkEAjJZqWsGu%2B4QuYm0hPp37v%2F8RbFI1I%2FAqI7EsKKIqBaFLXcHIywa07iYRbLxlQM9P32%2BpQi9Qg2qN0IqtQ1pXilIQVbIkIU%2BpP%2FmavQ3%2F%2BK%2FcOW8bB4UN8CjFPMcfmN380OiXJ%2FwhMYJEj82TwPgCIbmIMOpP%2F5N7qMX29Zzw%2Fjwki5DAk4AU4Xk2Y8cXSQxLB1elnYP%2Bn2syuKs4n%2FPT%2FBzY6deBMnPQoC08BP3Ixwv3A9zBlLElD0xpi%2BLd2qeRlXHslWx03gqxIpmTHFVjK7AzUvB3Zj56yZwX%2FmGYA63dIKMsqQtQeYtg1Nplop%2FHqo1kMq6efM%2FPZFjZhLByJfCgCA%2Fj5cmZSljRcWDfjazSNPEcXSX3jOAy1FnRMg%2B%2BoseEz8s%2BwtuQ3Nf38%2BhYavI6ES7rG4w8NrerAY6tAIjVSAoMKOFh8Rq320Fva4J%2FLfVjpYEwiYEZGdvUnYOWZykichQcOCnRL5sldPF1PT5Z1IFLZKKPoJAH1%2FaJBGGHxg5Wm4ySrre8e2qan9p%2FoeU69%2BMzpSYqcyg1s946naG3Ar5GNiWxJVo%2BRr4tcFDt7f8HqYkVvJlBtddr5qx3wbcv8lPlrfIjQ4pEwxfdp1%2BieXlP4WjimQ0Q8TNPG3EA1oRr%2Fi%2FQK2jOFqnXeKRYggR4EkIni3VOtund9E9x6c%2Fu7aBi%2ByOJW1gLf3VRvO3FGlaS9cq%2FGhwMNcgtrtL%2BJP0RLh60uZ4dLgo17lXQ3i7XmgQHWVaY5RZi3hb5Ur5pyjcsDjblm%2BoSmCKBndb9K0UxiKA%2B4uiNIdVrnEgx8D4M%2B9RJSvO0eTY5GukF8%2F67fiTRQ%3D%3D&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20240105T072258Z&X-Amz-SignedHeaders=host&X-Amz-Expires=300&X-Amz-Credential=ASIASTMY22BD7X7NJE5I%2F20240105%2Fap-southeast-2%2Fs3%2Faws4_request&X-Amz-Signature=077fd9107a01c9f585d4ccd091272756328a088a3b630882f9c4576b5a93fa71"
              className="px-1 inline-block py-1 w-full sm:w-fit rounded-full bg-gradient-to-br from-[#868F96] to-[#596164] hover:bg-slate-800 text-white mt-3"
            >
              <span className="block bg-[#121212] hover:bg-slate-800 rounded-full px-5 py-2">
                Download Resume
              </span>
            </Link>
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="col-span-4 place-self-center mt-4 lg:mt-0"
        >
          <div className="rounded-full bg-[#181818] w-[250px] h-[250px] lg:w-[400px] lg:h-[400px] relative">
            <Image
              src="/images/portrait.png"
              alt="hero image"
              className="absolute transform -translate-x-1/2 -translate-y-1/2 top-1/2 left-1/2"
              width={390}
              height={390}
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;