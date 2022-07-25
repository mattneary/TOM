import React from 'react'
import ReactDOM from 'react-dom'
import App from './index'

const content = `
Man, as we know him, is a comparative late-comer in the history of the Earth and tenuous film of life which its surface has supported. In certain respects he is one of the most fragile of living creatures—yet, in the manner of his explosive appearance on the scene, and the ways in which he has profoundly altered the environment within which he developed, he is the most powerful organism to have emerged so far.

This ‘power’ to which we will often refer, (and indeed upon which this entire report is a commentary) is not visible physical power, but rather the wholly invisible power of the brain. Linnaeus, the eminent Swedish botanist, first gave the name *homo sapiens* to our present human strain. The wisdom (or “sapien”) referred to is not so developed in the traditional sense as we might desire, but as intellect or brain power it is awesomely demonstrable.

Yet the difference between man and other organisms seems still only a matter of degree—of relative weight of brain, perhaps, and the number of its surface convolutions—but it is a marginal difference which is sufficient to alter significantly the way in which man has so far evolved. This difference has served to provide two main characteristics which set him apart from all other creatures. One is the ability to transmit his consciously accumulated knowledge from one generation to another and across many generations, and the other to externalise his organic functions into extent fabricated from his material environment—his tools. These features, combined, have enabled man, in spite of his relatively puny physical stature, to adapt himself to his environment so that he has been able to survive severe climatic and other changes, and to spread swiftly out into every corner of the Earth.

His capacity to transcend the temporal limits of his own life span by communicating his thought and feelings through many generations has given him an unique ‘continuous’ quality. Though his physical body may be entirely changed through cell renewal many times in his life and eventually be dissolved into its constituent parts. In the sense referred to even the individual may be ‘continuous’, and the overlapping and interweaving of generations of communicating individuals make man, potentially, an organism which never sleeps, dies, or forgets …
`.trim()
ReactDOM.render(<App content={content} />, document.body)
